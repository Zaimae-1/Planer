package main

import (
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

type event struct {
	ID       string `json:"id"`
	Date     string `json:"date"`
	Time     string `json:"time"`
	Title    string `json:"title"`
	Category string `json:"category"`
	Done     bool   `json:"done"`
}

func scanEvent(row scanner, e *event) error {
	return row.Scan(&e.ID, &e.Date, &e.Time, &e.Title, &e.Category, &e.Done)
}

var timePattern = regexp.MustCompile(`^(?:[01]\d|2[0-3]):[0-5]\d$`)

func (e *event) validate() error {
	date, err := time.Parse(time.DateOnly, e.Date)
	if err != nil || date.Year() < 1 || date.Format(time.DateOnly) != e.Date {
		return invalid("Tanggal kegiatan tidak valid.")
	}
	if e.Time != "" && !timePattern.MatchString(e.Time) {
		return invalid("Jam kegiatan tidak valid.")
	}
	e.Title = strings.TrimSpace(e.Title)
	if n := utf8.RuneCountInString(e.Title); n < 1 || n > 100 {
		return invalid("Nama kegiatan harus berisi 1–100 karakter.")
	}
	switch e.Category {
	case "rapat", "kegiatan", "tenggat":
		return nil
	default:
		return invalid("Pilih kategori kegiatan.")
	}
}

func insertEvent(db executor, team string, e event) error {
	_, err := db.Exec("INSERT INTO events (id, team, date, time, title, category, done) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		e.ID, team, e.Date, e.Time, e.Title, e.Category, e.Done)
	return err
}

func (a *app) addEvent(w http.ResponseWriter, r *http.Request, user *account) error {
	var e event
	if err := readJSON(w, r, &e, 16<<10); err != nil {
		return err
	}
	if err := e.validate(); err != nil {
		return err
	}
	e.ID, e.Done = randomToken(), false
	if err := insertEvent(a.db, user.team, e); err != nil {
		return err
	}
	return respond(w, 201, e)
}

func (a *app) updateEvent(w http.ResponseWriter, r *http.Request, user *account) error {
	var patch struct {
		Date, Time, Title, Category *string
		Done                        *bool
	}
	if err := readJSON(w, r, &patch, 16<<10); err != nil {
		return err
	}
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var e event
	err = scanEvent(tx.QueryRow("SELECT id, date, time, title, category, done FROM events WHERE id = $1 AND team = $2 FOR UPDATE",
		r.PathValue("id"), user.team), &e)
	if errors.Is(err, sql.ErrNoRows) {
		return fail(404, "Kegiatan tidak ditemukan.")
	}
	if err != nil {
		return err
	}
	if patch.Date != nil {
		e.Date = *patch.Date
	}
	if patch.Time != nil {
		e.Time = *patch.Time
	}
	if patch.Title != nil {
		e.Title = *patch.Title
	}
	if patch.Category != nil {
		e.Category = *patch.Category
	}
	if patch.Done != nil {
		e.Done = *patch.Done
	}
	if err := e.validate(); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE events SET date = $1, time = $2, title = $3, category = $4, done = $5 WHERE id = $6",
		e.Date, e.Time, e.Title, e.Category, e.Done, e.ID); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	w.WriteHeader(204)
	return nil
}

func ensureChanged(result sql.Result, err error, message string) error {
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err == nil && count == 0 {
		return fail(404, message)
	}
	return err
}

func (a *app) deleteEvent(w http.ResponseWriter, r *http.Request, user *account) error {
	result, err := a.db.Exec("DELETE FROM events WHERE id = $1 AND team = $2", r.PathValue("id"), user.team)
	if err := ensureChanged(result, err, "Kegiatan tidak ditemukan."); err != nil {
		return err
	}
	w.WriteHeader(204)
	return nil
}

func (a *app) workspace(w http.ResponseWriter, _ *http.Request, user *account) error {
	if _, err := a.db.Exec("UPDATE accounts SET seen = $1 WHERE id = $2 AND seen < $3",
		timestamp(), user.ID, time.Now().Add(-10*time.Second).UnixMilli()); err != nil {
		return err
	}
	memberRows, err := a.db.Query("SELECT "+accountColumns+" FROM accounts a JOIN space_members m ON m.account=a.id WHERE m.space=$1 ORDER BY a.id <> $2, example, name", user.team, user.space.Owner)
	if err != nil {
		return err
	}
	defer memberRows.Close()
	members := make([]*account, 0)
	for memberRows.Next() {
		member, err := readAccount(memberRows)
		if err != nil {
			return err
		}
		members = append(members, member)
	}
	if err := memberRows.Err(); err != nil {
		return err
	}
	rows, err := a.db.Query("SELECT id, date, time, title, category, done FROM events WHERE team = $1 ORDER BY date, time = '', time, id", user.team)
	if err != nil {
		return err
	}
	defer rows.Close()
	events := make([]event, 0)
	for rows.Next() {
		var e event
		if err := scanEvent(rows, &e); err != nil {
			return err
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return respond(w, 200, map[string]any{"space": user.space, "members": members, "events": events})
}
