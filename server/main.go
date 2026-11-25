package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	_ "embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
)

//go:embed schema.sql
var schema string

type app struct {
	db          *sql.DB
	secure      bool
	mu          sync.Mutex
	requests    map[string]attempt
	lastCleanup time.Time
}

type attempt struct {
	count int
	until time.Time
}

type httpError struct {
	status  int
	message string
}

func (e httpError) Error() string           { return e.message }
func fail(status int, message string) error { return httpError{status, message} }
func invalid(message string) error          { return fail(http.StatusBadRequest, message) }

func uniqueError(err error, message string) error {
	var e *pgconn.PgError
	if errors.As(err, &e) && e.Code == "23505" {
		return fail(409, message)
	}
	return err
}

type handler func(http.ResponseWriter, *http.Request, *account) error

func (a *app) endpoint(fn handler, access string, limit int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		run := func() error {
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				return fail(403, "Akses lintas situs diblokir.")
			}
			user, err := a.session(r)
			if err != nil {
				return err
			}
			if access != "" && user == nil {
				return fail(401, "Silakan masuk untuk mengakses Planer.")
			}
			if access == "space" || access == "team" {
				if err := a.scope(r, user); err != nil {
					return err
				}
				if access == "team" && user.space.Kind != "team" {
					return fail(403, "Pilih ruang tim untuk mengakses fitur ini.")
				}
			}
			if limit > 0 && !a.allow(r, user, limit) {
				return fail(429, "Terlalu banyak percobaan. Coba lagi nanti.")
			}
			return fn(w, r, user)
		}
		if err := run(); err != nil {
			var e httpError
			if !errors.As(err, &e) {
				log.Print(err)
				e = httpError{500, "Terjadi gangguan. Coba lagi sebentar."}
			}
			respond(w, e.status, map[string]string{"error": e.message})
		}
	}
}

func (a *app) allow(r *http.Request, user *account, limit int) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if user != nil {
		host = user.ID
	}
	key := r.Pattern + ":" + host
	now := time.Now()
	a.mu.Lock()
	defer a.mu.Unlock()
	if now.Sub(a.lastCleanup) > time.Minute {
		for key, entry := range a.requests {
			if !entry.until.After(now) {
				delete(a.requests, key)
			}
		}
		a.lastCleanup = now
	}
	entry := a.requests[key]
	if !entry.until.After(now) {
		entry = attempt{until: now.Add(15 * time.Minute)}
	}
	entry.count++
	a.requests[key] = entry
	return entry.count <= limit
}

func respond(w http.ResponseWriter, status int, data any) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(data)
}

func readJSON(w http.ResponseWriter, r *http.Request, body any, max int64) error {
	if r.Header.Get("Content-Type") != "application/json" {
		return fail(415, "Gunakan format application/json.")
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, max))
	if err := decoder.Decode(body); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return fail(413, "Ukuran data melebihi batas.")
		}
		return invalid("Format data tidak valid.")
	}
	if decoder.Decode(new(any)) != io.EOF {
		return invalid("Format data tidak valid.")
	}
	return nil
}

func randomToken() string {
	return base64.RawURLEncoding.EncodeToString(randBytes(32))
}

func randBytes(size int) []byte {
	buf := make([]byte, size)
	rand.Read(buf)
	return buf
}

func hash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func environment(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func openDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	if _, err = db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func (a *app) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/session", a.endpoint(func(w http.ResponseWriter, r *http.Request, user *account) error {
		return respond(w, 200, user)
	}, "", 0))
	mux.HandleFunc("POST /api/demo", a.endpoint(a.demo, "", 24))
	mux.HandleFunc("POST /api/register", a.endpoint(a.register, "", 12))
	mux.HandleFunc("POST /api/login", a.endpoint(a.login, "", 20))
	mux.HandleFunc("POST /api/logout", a.endpoint(a.logout, "", 0))
	mux.HandleFunc("POST /api/join", a.endpoint(a.join, "", 30))
	mux.HandleFunc("GET /api/spaces", a.endpoint(a.spaces, "signed", 0))
	mux.HandleFunc("POST /api/spaces", a.endpoint(a.addSpace, "signed", 20))
	mux.HandleFunc("GET /api/workspace", a.endpoint(a.workspace, "space", 0))
	mux.HandleFunc("POST /api/events", a.endpoint(a.addEvent, "space", 0))
	mux.HandleFunc("PATCH /api/events/{id}", a.endpoint(a.updateEvent, "space", 0))
	mux.HandleFunc("DELETE /api/events/{id}", a.endpoint(a.deleteEvent, "space", 0))
	mux.HandleFunc("POST /api/invites", a.endpoint(a.invite, "team", 30))
	mux.HandleFunc("POST /api/invites/{id}/verify", a.endpoint(a.verify, "team", 0))
	mux.HandleFunc("GET /api/notifications", a.endpoint(a.notifications, "signed", 0))
	mux.HandleFunc("PATCH /api/notifications/{id}", a.endpoint(a.resolveInvite, "signed", 0))
	mux.HandleFunc("GET /api/messages", a.endpoint(a.messages, "team", 0))
	mux.HandleFunc("POST /api/messages", a.endpoint(a.send, "team", 0))
	mux.HandleFunc("PATCH /api/messages/{id}/pin", a.endpoint(a.pin, "team", 0))
	mux.HandleFunc("GET /api/messages/{id}/media", a.endpoint(a.media, "signed", 0))
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 404, map[string]string{"error": "Halaman API tidak ditemukan."})
	})
	for _, page := range []string{"/{$}", "/dashboard", "/agenda", "/messages", "/invite", "/notifications", "/register", "/login", "/join"} {
		mux.HandleFunc("GET "+page, func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, "dist/index.html")
		})
	}
	mux.Handle("/", http.FileServer(http.Dir("dist")))
	return mux
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("Atur DATABASE_URL untuk menghubungkan Planer ke PostgreSQL.")
	}
	db, err := openDB(dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	a := &app{db: db, secure: os.Getenv("PLANER_HTTPS") == "1", requests: make(map[string]attempt)}
	address := net.JoinHostPort(environment("HOST", "127.0.0.1"), environment("PORT", "3001"))
	server := &http.Server{
		Addr: address, Handler: a.routes(), ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 90 * time.Second, WriteTimeout: 90 * time.Second, IdleTimeout: 60 * time.Second,
	}
	log.Printf("Planer berjalan di http://%s", strings.TrimSpace(address))
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(fmt.Errorf("planer: %w", err))
	}
}
