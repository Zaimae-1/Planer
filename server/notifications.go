package main

import (
	"database/sql"
	"errors"
	"net/http"
)

type notification struct {
	ID        string `json:"id"`
	SpaceID   string `json:"spaceId"`
	SpaceName string `json:"spaceName"`
	Sender    string `json:"sender"`
	Status    string `json:"status"`
	Created   int64  `json:"created"`
}

func (a *app) notifications(w http.ResponseWriter, r *http.Request, user *account) error {
	rows, err := a.db.QueryContext(r.Context(), `
		SELECT i.id,i.team,s.name,a.name,i.status,i.created
		FROM invites i JOIN spaces s ON s.id=i.team JOIN accounts a ON a.id=i.invited_by
		WHERE i.target=$1 ORDER BY i.status <> 'pending',i.created DESC,i.id`, user.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]notification, 0)
	for rows.Next() {
		var item notification
		if err := rows.Scan(&item.ID, &item.SpaceID, &item.SpaceName, &item.Sender, &item.Status, &item.Created); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return respond(w, 200, items)
}

func (a *app) resolveInvite(w http.ResponseWriter, r *http.Request, user *account) error {
	var body struct{ Decision string }
	if err := readJSON(w, r, &body, 16<<10); err != nil {
		return err
	}
	status := ""
	switch body.Decision {
	case "accept":
		status = "accepted"
	case "decline":
		status = "declined"
	default:
		return invalid("Pilih terima atau tolak undangan.")
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var accountID string
	if err := tx.QueryRow("SELECT id FROM accounts WHERE id=$1 FOR NO KEY UPDATE", user.ID).Scan(&accountID); err != nil {
		return err
	}
	var team string
	err = tx.QueryRow("UPDATE invites SET status=$1 WHERE id=$2 AND target=$3 AND status='pending' RETURNING team",
		status, r.PathValue("id"), accountID).Scan(&team)
	if errors.Is(err, sql.ErrNoRows) {
		return fail(404, "Undangan sudah ditanggapi atau tidak ditemukan.")
	}
	if err != nil {
		return err
	}
	if status == "accepted" {
		if _, err := tx.Exec("INSERT INTO space_members VALUES ($1,$2) ON CONFLICT DO NOTHING", team, user.ID); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respond(w, 200, map[string]string{"status": status, "spaceId": team})
}
