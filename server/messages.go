package main

import (
	"bytes"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

const uploadLimit = 20 << 20

type message struct {
	ID        string  `json:"id"`
	Author    string  `json:"author"`
	Name      string  `json:"name"`
	Body      string  `json:"body"`
	Sent      int64   `json:"sent"`
	Pinned    *int64  `json:"pinned"`
	Mime      *string `json:"mime"`
	Filename  *string `json:"filename"`
	Reply     *string `json:"reply"`
	ReplyBody *string `json:"replyBody"`
	ReplyName *string `json:"replyName"`
	ReplyFile *string `json:"replyFile"`
}

func (a *app) writeMessages(w http.ResponseWriter, status int, team string) error {
	rows, err := a.db.Query(
		`SELECT m.id, m.author, a.name, m.body, m.sent, m.pinned, m.mime, m.filename, m.reply,
		       parent.body, author.name, parent.filename
		 FROM messages m JOIN accounts a ON a.id = m.author
		 LEFT JOIN messages parent ON parent.id = m.reply LEFT JOIN accounts author ON author.id = parent.author
		 WHERE m.team = $1 AND (m.pinned IS NOT NULL OR m.id IN (
		   SELECT id FROM messages WHERE team = $1 ORDER BY sent DESC, id DESC LIMIT 100
		 ))
		 ORDER BY m.sent, m.id`, team)
	if err != nil {
		return err
	}
	defer rows.Close()
	messages := make([]message, 0)
	for rows.Next() {
		var m message
		if err := rows.Scan(&m.ID, &m.Author, &m.Name, &m.Body, &m.Sent, &m.Pinned, &m.Mime, &m.Filename,
			&m.Reply, &m.ReplyBody, &m.ReplyName, &m.ReplyFile); err != nil {
			return err
		}
		messages = append(messages, m)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return respond(w, status, map[string]any{"messages": messages})
}

func (a *app) messages(w http.ResponseWriter, _ *http.Request, user *account) error {
	return a.writeMessages(w, 200, user.team)
}

func allowedMedia(mime string) bool {
	switch mime {
	case "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
		"video/mp4", "video/webm", "video/quicktime", "audio/webm", "audio/ogg", "audio/mp4",
		"audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac", "audio/m4a", "audio/x-m4a":
		return true
	}
	return false
}

func (a *app) send(w http.ResponseWriter, r *http.Request, user *account) error {
	var body struct {
		Text       string
		Reply      *string
		Attachment *struct {
			Mime, Name string
			Data       []byte
		}
	}
	if err := readJSON(w, r, &body, 28<<20); err != nil {
		return err
	}
	body.Text = strings.TrimSpace(body.Text)
	if utf8.RuneCountInString(body.Text) > 4000 {
		return invalid("Pesan maksimal 4.000 karakter.")
	}
	if body.Text == "" && body.Attachment == nil {
		return invalid("Tulis pesan atau pilih lampiran.")
	}
	var mime, filename *string
	var media []byte
	if file := body.Attachment; file != nil {
		file.Mime, _, _ = strings.Cut(file.Mime, ";")
		file.Name = strings.TrimSpace(file.Name)
		if !allowedMedia(file.Mime) {
			return invalid("Format file belum didukung.")
		}
		if file.Name == "" || utf8.RuneCountInString(file.Name) > 180 {
			return invalid("Nama file harus berisi 1–180 karakter.")
		}
		if len(file.Data) == 0 || len(file.Data) > uploadLimit {
			return invalid("Ukuran lampiran maksimal 20 MB.")
		}
		mime, filename, media = &file.Mime, &file.Name, file.Data
	}
	if body.Reply != nil {
		var exists bool
		if err := a.db.QueryRow("SELECT EXISTS(SELECT 1 FROM messages WHERE id = $1 AND team = $2)", *body.Reply, user.team).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return fail(404, "Pesan yang dibalas tidak ditemukan.")
		}
	}
	if _, err := a.db.Exec("INSERT INTO messages (id,team,author,body,reply,sent,mime,filename,media) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
		randomToken(), user.team, user.ID, body.Text, body.Reply, timestamp(), mime, filename, media); err != nil {
		return err
	}
	return a.writeMessages(w, 201, user.team)
}

func (a *app) pin(w http.ResponseWriter, r *http.Request, user *account) error {
	var body struct{ Pinned *bool }
	if err := readJSON(w, r, &body, 16<<10); err != nil {
		return err
	}
	if body.Pinned == nil {
		return invalid("Status sematan tidak valid.")
	}
	var pinned *int64
	if *body.Pinned {
		now := timestamp()
		pinned = &now
	}
	result, err := a.db.Exec("UPDATE messages SET pinned = $1 WHERE id = $2 AND team = $3",
		pinned, r.PathValue("id"), user.team)
	if err := ensureChanged(result, err, "Pesan tidak ditemukan."); err != nil {
		return err
	}
	return a.writeMessages(w, 200, user.team)
}

func (a *app) media(w http.ResponseWriter, r *http.Request, user *account) error {
	var mime, filename string
	var data []byte
	err := a.db.QueryRow(`SELECT mime, filename, media FROM messages
		JOIN space_members ON space_members.space=messages.team
		WHERE messages.id=$1 AND space_members.account=$2 AND mime IS NOT NULL`,
		r.PathValue("id"), user.ID).Scan(&mime, &filename, &data)
	if errors.Is(err, sql.ErrNoRows) {
		return fail(404, "Lampiran tidak ditemukan.")
	}
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	http.ServeContent(w, r, filename, time.Time{}, bytes.NewReader(data))
	return nil
}
