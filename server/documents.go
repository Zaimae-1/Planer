package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"
)

type document struct {
	ID       string      `json:"id"`
	Title    string      `json:"title"`
	Updated  int64       `json:"updated"`
	Revision int         `json:"revision"`
	Blocks   []noteBlock `json:"blocks"`
}

type noteBlock struct {
	ID      string     `json:"id"`
	Type    string     `json:"type"`
	Text    string     `json:"text,omitempty"`
	Checked bool       `json:"checked,omitempty"`
	Cells   [][]string `json:"cells,omitempty"`
}

func validNoteText(value string, limit int) bool {
	return !strings.ContainsRune(value, 0) && utf8.RuneCountInString(value) <= limit
}

func (note *document) validate() error {
	note.Title = strings.TrimSpace(note.Title)
	if note.Title == "" || !validNoteText(note.Title, 120) {
		return invalid("Judul catatan harus berisi 1–120 karakter.")
	}
	if len(note.Blocks) > 100 {
		return invalid("Satu catatan dapat memuat maksimal 100 blok.")
	}
	if note.Blocks == nil {
		note.Blocks = []noteBlock{}
	}
	ids := make(map[string]bool, len(note.Blocks))
	for _, block := range note.Blocks {
		if block.ID == "" || !validNoteText(block.ID, 64) || ids[block.ID] || !validNoteText(block.Text, 8000) {
			return invalid("Isi blok catatan tidak valid.")
		}
		ids[block.ID] = true
		switch block.Type {
		case "text", "heading", "bullet", "checklist":
			if len(block.Cells) != 0 {
				return invalid("Isi blok catatan tidak valid.")
			}
		case "table":
			if len(block.Cells) < 1 || len(block.Cells) > 25 || len(block.Cells[0]) < 1 || len(block.Cells[0]) > 12 {
				return invalid("Tabel dapat memuat maksimal 25 baris dan 12 kolom.")
			}
			for _, row := range block.Cells {
				if len(row) != len(block.Cells[0]) {
					return invalid("Jumlah kolom setiap baris harus sama.")
				}
				for _, cell := range row {
					if !validNoteText(cell, 1000) {
						return invalid("Sel tabel dapat memuat maksimal 1.000 karakter.")
					}
				}
			}
		default:
			return invalid("Tipe blok catatan tidak valid.")
		}
	}
	return nil
}

func (a *app) documents(w http.ResponseWriter, r *http.Request, user *account) error {
	rows, err := a.db.QueryContext(r.Context(), "SELECT id, title, updated, revision FROM documents WHERE space=$1 ORDER BY updated DESC, id", user.team)
	if err != nil {
		return err
	}
	defer rows.Close()
	type entry struct {
		ID       string `json:"id"`
		Title    string `json:"title"`
		Updated  int64  `json:"updated"`
		Revision int    `json:"revision"`
	}
	result := make([]entry, 0)
	for rows.Next() {
		var note entry
		if err := rows.Scan(&note.ID, &note.Title, &note.Updated, &note.Revision); err != nil {
			return err
		}
		result = append(result, note)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return respond(w, 200, result)
}

func (a *app) getDocument(w http.ResponseWriter, r *http.Request, user *account) error {
	note := document{ID: r.PathValue("id")}
	var blocks []byte
	err := a.db.QueryRowContext(r.Context(), "SELECT title, updated, revision, blocks FROM documents WHERE id=$1 AND space=$2",
		note.ID, user.team).Scan(&note.Title, &note.Updated, &note.Revision, &blocks)
	if errors.Is(err, sql.ErrNoRows) {
		return fail(404, "Catatan tidak ditemukan.")
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal(blocks, &note.Blocks); err != nil {
		return err
	}
	return respond(w, 200, note)
}

func (a *app) createDocument(w http.ResponseWriter, r *http.Request, user *account) error {
	var input struct{ Title string }
	if err := readJSON(w, r, &input, 4096); err != nil {
		return err
	}
	note := document{ID: randomToken(), Title: input.Title, Updated: timestamp(), Revision: 1}
	if err := note.validate(); err != nil {
		return err
	}
	if _, err := a.db.ExecContext(r.Context(), "INSERT INTO documents(id, space, title, updated) VALUES($1,$2,$3,$4)",
		note.ID, user.team, note.Title, note.Updated); err != nil {
		return err
	}
	return respond(w, 201, note)
}

func (a *app) saveDocument(w http.ResponseWriter, r *http.Request, user *account) error {
	var note document
	if err := readJSON(w, r, &note, 640<<10); err != nil {
		return err
	}
	if err := note.validate(); err != nil {
		return err
	}
	blocks, err := json.Marshal(note.Blocks)
	if err != nil {
		return err
	}
	note.ID, note.Updated = r.PathValue("id"), timestamp()
	err = a.db.QueryRowContext(r.Context(), `UPDATE documents SET title=$1, blocks=$2::jsonb, updated=$3, revision=revision+1
		WHERE id=$4 AND space=$5 AND revision=$6 RETURNING revision`, note.Title, string(blocks), note.Updated, note.ID, user.team, note.Revision).Scan(&note.Revision)
	if errors.Is(err, sql.ErrNoRows) {
		return fail(409, "Catatan sudah diubah atau dihapus. Muat ulang versi terbaru.")
	}
	if err != nil {
		return err
	}
	return respond(w, 200, note)
}

func (a *app) deleteDocument(w http.ResponseWriter, r *http.Request, user *account) error {
	var input struct{ Revision int }
	if err := readJSON(w, r, &input, 1024); err != nil {
		return err
	}
	result, err := a.db.ExecContext(r.Context(), "DELETE FROM documents WHERE id=$1 AND space=$2 AND revision=$3",
		r.PathValue("id"), user.team, input.Revision)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return fail(409, "Catatan sudah diubah atau dihapus. Muat ulang versi terbaru.")
	}
	w.WriteHeader(204)
	return nil
}
