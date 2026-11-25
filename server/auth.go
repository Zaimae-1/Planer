package main

import (
	"crypto/pbkdf2"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

const accountColumns = "a.id, a.name, a.username, a.email, a.demo, a.example, a.seen, a.password"
const cookieName = "planer_session"
const sessionAge = 30 * 24 * time.Hour

type account struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Demo     bool   `json:"demo"`
	Online   bool   `json:"online"`
	team     string
	space    *space
	password sql.NullString
}

type scanner interface{ Scan(...any) error }

func readAccount(row scanner) (*account, error) {
	var user account
	var example int
	var seen int64
	err := row.Scan(&user.ID, &user.Name, &user.Username, &user.Email,
		&user.Demo, &example, &seen, &user.password)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	user.Online = example == 1 || example == 0 && time.Since(time.UnixMilli(seen)) < 45*time.Second
	return &user, nil
}

func (a *app) session(r *http.Request) (*account, error) {
	cookie, err := r.Cookie(cookieName)
	if err != nil || len(cookie.Value) != 43 {
		return nil, nil
	}
	return readAccount(a.db.QueryRowContext(r.Context(), "SELECT "+accountColumns+
		" FROM sessions s JOIN accounts a ON a.id = s.account WHERE s.token = $1 AND s.expires > $2",
		hash(cookie.Value), timestamp()))
}

type executor interface {
	Exec(string, ...any) (sql.Result, error)
}

func insertSession(db executor, user *account) (string, error) {
	key := randomToken()
	now := time.Now()
	if _, err := db.Exec("DELETE FROM sessions WHERE expires <= $1", now.UnixMilli()); err != nil {
		return "", err
	}
	if _, err := db.Exec("INSERT INTO sessions VALUES ($1, $2, $3)", hash(key), user.ID, now.Add(sessionAge).UnixMilli()); err != nil {
		return "", err
	}
	if _, err := db.Exec("UPDATE accounts SET seen = $1 WHERE id = $2", now.UnixMilli(), user.ID); err != nil {
		return "", err
	}
	user.Online = true
	return key, nil
}

func (a *app) writeSession(w http.ResponseWriter, key string, seconds int) {
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: key, Path: "/", HttpOnly: true,
		Secure: a.secure, SameSite: http.SameSiteLaxMode, MaxAge: seconds})
}

func (a *app) signIn(w http.ResponseWriter, user *account, status int) error {
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	key, err := insertSession(tx, user)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	a.writeSession(w, key, int(sessionAge.Seconds()))
	return respond(w, status, user)
}

func timestamp() int64 { return time.Now().UnixMilli() }

func (a *app) logout(w http.ResponseWriter, r *http.Request, user *account) error {
	if user != nil {
		cookie, _ := r.Cookie(cookieName)
		tx, err := a.db.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()
		if _, err := tx.Exec("DELETE FROM sessions WHERE token = $1", hash(cookie.Value)); err != nil {
			return err
		}
		if _, err := tx.Exec("UPDATE accounts SET seen = 0 WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM sessions WHERE account = $1 AND expires > $2)", user.ID, timestamp()); err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	a.writeSession(w, "", -1)
	w.WriteHeader(204)
	return nil
}

type contact struct {
	Username string
	Email    string
	Phone    string
}

var (
	usernamePattern = regexp.MustCompile(`^[\pL\pN_.-]{3,30}$`)
	emailPattern    = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	phonePattern    = regexp.MustCompile(`^\+?\d{8,15}$`)
)

func normalizePhone(value string) string {
	value = strings.NewReplacer(" ", "", "(", "", ")", "", "-", "").Replace(strings.TrimSpace(value))
	if strings.HasPrefix(value, "+62") {
		return "0" + value[3:]
	}
	if strings.HasPrefix(value, "62") {
		return "0" + value[2:]
	}
	return value
}

func (c *contact) validate() error {
	c.Username = strings.TrimSpace(c.Username)
	c.Email = strings.ToLower(strings.TrimSpace(c.Email))
	c.Phone = normalizePhone(c.Phone)
	switch {
	case !usernamePattern.MatchString(c.Username):
		return invalid("Username harus berisi 3–30 huruf, angka, titik, setrip, atau garis bawah.")
	case len(c.Email) > 120 || !emailPattern.MatchString(c.Email):
		return invalid("Masukkan alamat email yang valid.")
	case !phonePattern.MatchString(c.Phone):
		return invalid("Masukkan nomor HP yang valid.")
	default:
		return nil
	}
}

func passwordHash(password, salt string) string {
	key, err := pbkdf2.Key(sha256.New, password, []byte(salt), 600_000, 32)
	if err != nil {
		panic(err)
	}
	return salt + ":" + hex.EncodeToString(key)
}

type credentials struct{ Name, Password, Confirmation string }

func (c *credentials) validate() error {
	c.Name = strings.TrimSpace(c.Name)
	if size := utf8.RuneCountInString(c.Name); size < 2 || size > 70 {
		return invalid("Nama lengkap harus berisi 2–70 karakter.")
	}
	if size := utf8.RuneCountInString(c.Password); size < 8 || size > 128 {
		return invalid("Kata sandi harus terdiri dari 8–128 karakter.")
	}
	if c.Password != c.Confirmation {
		return invalid("Konfirmasi kata sandi belum cocok.")
	}
	return nil
}

func addAccount(tx *sql.Tx, person contact, credentials credentials) (*account, error) {
	user := &account{ID: randomToken(), Name: credentials.Name, Username: person.Username, Email: person.Email}
	password := passwordHash(credentials.Password, hex.EncodeToString(randBytes(16)))
	if _, err := tx.Exec("INSERT INTO accounts (id, name, username, email, phone, password) VALUES ($1,$2,$3,$4,$5,$6)",
		user.ID, user.Name, user.Username, user.Email, person.Phone, password); err != nil {
		return nil, uniqueError(err, "Email, nomor HP, atau username sudah terdaftar.")
	}
	if _, err := createSpace(tx, user.ID, "Kalender pribadi", "personal"); err != nil {
		return nil, err
	}
	return user, nil
}

func (a *app) register(w http.ResponseWriter, r *http.Request, _ *account) error {
	var body struct {
		contact
		credentials
	}
	if err := readJSON(w, r, &body, 16<<10); err != nil {
		return err
	}
	if err := body.contact.validate(); err != nil {
		return err
	}
	if err := body.credentials.validate(); err != nil {
		return err
	}
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	user, err := addAccount(tx, body.contact, body.credentials)
	if err != nil {
		return err
	}
	key, err := insertSession(tx, user)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	a.writeSession(w, key, int(sessionAge.Seconds()))
	return respond(w, 201, user)
}

func (a *app) login(w http.ResponseWriter, r *http.Request, _ *account) error {
	var body struct{ Identifier, Password string }
	if err := readJSON(w, r, &body, 16<<10); err != nil {
		return err
	}
	denied := fail(401, "Email, nomor HP, atau kata sandi salah.")
	if utf8.RuneCountInString(body.Password) > 128 {
		return denied
	}
	user, err := readAccount(a.db.QueryRow("SELECT "+accountColumns+" FROM accounts a WHERE password IS NOT NULL AND (email = $1 OR phone = $2)",
		strings.ToLower(strings.TrimSpace(body.Identifier)), normalizePhone(body.Identifier)))
	if err != nil {
		return err
	}
	saved := "00000000000000000000000000000000:" + strings.Repeat("0", 64)
	if user != nil {
		saved = user.password.String
	}
	salt, _, _ := strings.Cut(saved, ":")
	if subtle.ConstantTimeCompare([]byte(passwordHash(body.Password, salt)), []byte(saved)) != 1 || user == nil {
		return denied
	}
	return a.signIn(w, user, 200)
}
