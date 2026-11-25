package main

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"
)

func (a *app) invite(w http.ResponseWriter, r *http.Request, user *account) error {
	var body struct {
		contact
		Identifier, Channel string
	}
	if err := readJSON(w, r, &body, 16<<10); err != nil {
		return err
	}
	if identifier := strings.TrimSpace(body.Identifier); identifier != "" {
		return a.inviteAccount(w, r, user, identifier)
	}
	if err := body.contact.validate(); err != nil {
		return err
	}
	if body.Channel != "whatsapp" && body.Channel != "gmail" {
		return invalid("Pilih metode verifikasi.")
	}
	var exists bool
	if err := a.db.QueryRow("SELECT EXISTS (SELECT 1 FROM accounts WHERE NOT demo AND (lower(username) = lower($1) OR email = $2 OR phone = $3))",
		body.Username, body.Email, body.Phone).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return fail(409, "Kontak ini sudah punya akun. Gunakan undangan akun Planer.")
	}
	id := randomToken()
	number, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return err
	}
	code := fmt.Sprint(number.Int64() + 100000)
	expires := time.Now().Add(10 * time.Minute).UnixMilli()
	if _, err := a.db.Exec(`INSERT INTO invites (id,team,invited_by,username,email,phone,channel,status,created,code,expires)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'verify',$8,$9,$10)`,
		id, user.team, user.ID, body.Username, body.Email, body.Phone, body.Channel, timestamp(), hash(id+":"+code), expires); err != nil {
		return err
	}
	return respond(w, 201, map[string]any{"id": id, "code": code})
}

func (a *app) inviteAccount(w http.ResponseWriter, r *http.Request, user *account, identifier string) error {
	identifier = strings.TrimPrefix(identifier, "@")
	if len(identifier) > 120 {
		return invalid("Username, email, atau nomor HP tidak valid.")
	}
	phone := normalizePhone(identifier)
	if !phonePattern.MatchString(phone) {
		phone = ""
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	rows, err := tx.Query(`SELECT id FROM accounts WHERE NOT demo
		AND (lower(username)=lower($1) OR email=lower($1) OR (phone=$2 AND $2<>''))
		ORDER BY id FOR NO KEY UPDATE`, identifier, phone)
	if err != nil {
		return err
	}
	var targets []string
	for rows.Next() {
		var target string
		if err := rows.Scan(&target); err != nil {
			rows.Close()
			return err
		}
		targets = append(targets, target)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	if len(targets) == 0 {
		return fail(404, "Akun Planer tidak ditemukan. Periksa kontak atau buat tautan undangan.")
	}
	if len(targets) > 1 {
		return invalid("Pencarian cocok dengan beberapa akun. Gunakan alamat email.")
	}
	target := targets[0]
	var member bool
	if err := tx.QueryRow("SELECT EXISTS(SELECT 1 FROM space_members WHERE space=$1 AND account=$2)", user.team, target).Scan(&member); err != nil {
		return err
	}
	if member {
		return fail(409, "Akun ini sudah menjadi anggota tim.")
	}
	_, err = tx.Exec("INSERT INTO invites (id,team,invited_by,target,status,created) VALUES ($1,$2,$3,$4,'pending',$5)",
		randomToken(), user.team, user.ID, target, timestamp())
	if err != nil {
		return uniqueError(err, "Undangan untuk akun ini sudah menunggu jawaban.")
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respond(w, 201, map[string]string{"status": "pending"})
}

func (a *app) verify(w http.ResponseWriter, r *http.Request, user *account) error {
	var body struct{ Code string }
	if err := readJSON(w, r, &body, 16<<10); err != nil {
		return err
	}
	if len(body.Code) != 6 {
		return invalid("Masukkan 6 digit kode verifikasi.")
	}
	id := r.PathValue("id")
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var saved string
	var attempts int
	err = tx.QueryRow(`SELECT code, attempts FROM invites
		WHERE id=$1 AND team=$2 AND invited_by=$3 AND expires>$4 AND status='verify' FOR UPDATE`,
		id, user.team, user.ID, timestamp()).Scan(&saved, &attempts)
	if errors.Is(err, sql.ErrNoRows) {
		return fail(404, "Undangan kedaluwarsa atau sudah diverifikasi.")
	}
	if err != nil {
		return err
	}
	if attempts >= 5 {
		return fail(429, "Percobaan habis. Buat undangan baru.")
	}
	if subtle.ConstantTimeCompare([]byte(saved), []byte(hash(id+":"+body.Code))) != 1 {
		if _, err := tx.Exec("UPDATE invites SET attempts=attempts+1 WHERE id=$1", id); err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		return invalid("Kode verifikasi salah.")
	}
	access := randomToken()
	if _, err := tx.Exec("UPDATE invites SET status='link', access=$1, access_expires=$2, code=NULL WHERE id=$3",
		hash(access), time.Now().Add(48*time.Hour).UnixMilli(), id); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return respond(w, 200, map[string]string{"token": access})
}

func (a *app) join(w http.ResponseWriter, r *http.Request, _ *account) error {
	var body struct {
		credentials
		Token string
	}
	if err := readJSON(w, r, &body, 16<<10); err != nil {
		return err
	}
	unavailable := fail(404, "Tautan undangan tidak berlaku atau sudah dipakai.")
	if len(body.Token) != 43 {
		return unavailable
	}
	if err := body.credentials.validate(); err != nil {
		return err
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var person contact
	var id, team string
	err = tx.QueryRow(`SELECT id,team,username,email,phone FROM invites
		WHERE access=$1 AND access_expires>$2 AND status='link' FOR UPDATE`, hash(body.Token), timestamp()).
		Scan(&id, &team, &person.Username, &person.Email, &person.Phone)
	if errors.Is(err, sql.ErrNoRows) {
		return unavailable
	}
	if err != nil {
		return err
	}
	user, err := addAccount(tx, person, body.credentials)
	if err != nil {
		return err
	}
	if _, err := tx.Exec("INSERT INTO space_members VALUES ($1,$2)", team, user.ID); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE invites SET status='accepted',access=NULL WHERE id=$1", id); err != nil {
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
	return respond(w, 200, map[string]string{"spaceId": team})
}
