package main

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"
)

type space struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Kind  string `json:"kind"`
	Owner string `json:"owner"`
}

func createSpace(tx *sql.Tx, owner, name, kind string) (space, error) {
	item := space{ID: randomToken(), Name: name, Owner: owner, Kind: kind}
	if _, err := tx.Exec("INSERT INTO spaces (id,name,kind,owner,created) VALUES ($1,$2,$3,$4,$5)", item.ID, item.Name, item.Kind, item.Owner, timestamp()); err != nil {
		return item, err
	}
	_, err := tx.Exec("INSERT INTO space_members (space,account) VALUES ($1,$2)", item.ID, owner)
	return item, err
}

func (a *app) scope(r *http.Request, user *account) error {
	id := r.Header.Get("X-Planer-Workspace")
	var item space
	err := a.db.QueryRowContext(r.Context(), `
		SELECT s.id,s.name,s.kind,s.owner
		FROM spaces s JOIN space_members m ON m.space = s.id
		WHERE m.account = $1 AND ($2 = '' OR s.id = $2)
		ORDER BY CASE WHEN $3::boolean THEN s.kind <> 'team' ELSE s.kind <> 'personal' END, s.created, s.id
		LIMIT 1`, user.ID, id, user.Demo).Scan(&item.ID, &item.Name, &item.Kind, &item.Owner)
	if errors.Is(err, sql.ErrNoRows) {
		return fail(403, "Ruang ini belum bisa kamu akses.")
	}
	if err != nil {
		return err
	}
	user.team, user.space = item.ID, &item
	return nil
}

func (a *app) spaces(w http.ResponseWriter, r *http.Request, user *account) error {
	rows, err := a.db.QueryContext(r.Context(), `SELECT s.id,s.name,s.kind,s.owner FROM spaces s
		JOIN space_members m ON m.space = s.id WHERE m.account = $1
		ORDER BY s.kind,s.created,s.id`, user.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	result := make([]space, 0)
	for rows.Next() {
		var item space
		if err := rows.Scan(&item.ID, &item.Name, &item.Kind, &item.Owner); err != nil {
			return err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return respond(w, 200, result)
}

func (a *app) addSpace(w http.ResponseWriter, r *http.Request, user *account) error {
	var body struct{ Name string }
	if err := readJSON(w, r, &body, 16<<10); err != nil {
		return err
	}
	body.Name = strings.TrimSpace(body.Name)
	if n := utf8.RuneCountInString(body.Name); n < 2 || n > 60 {
		return invalid("Nama tim harus berisi 2–60 karakter.")
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	item, err := createSpace(tx, user.ID, body.Name, "team")
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respond(w, 201, item)
}
