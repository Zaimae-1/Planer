package main

import (
	"bytes"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"net/http"
	"strings"
)

type ownProfile struct {
	*account
	Phone string `json:"phone"`
}

func (a *app) profile(w http.ResponseWriter, _ *http.Request, user *account) error {
	return respond(w, 200, ownProfile{user, user.phone})
}

func (a *app) changeLanguage(w http.ResponseWriter, r *http.Request, user *account) error {
	var body struct{ Language string }
	if err := readJSON(w, r, &body, 1024); err != nil {
		return err
	}
	if body.Language != "id" && body.Language != "en" {
		return invalid("Pilih bahasa Indonesia atau English.")
	}
	if _, err := a.db.ExecContext(r.Context(), "UPDATE accounts SET language=$1 WHERE id=$2", body.Language, user.ID); err != nil {
		return err
	}
	w.WriteHeader(204)
	return nil
}

func decodeAvatar(encoded string) ([]byte, string, error) {
	if encoded == "" {
		return nil, "", nil
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(data) > 512<<10 {
		return nil, "", invalid("Foto profil maksimal 512 KB.")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "jpeg" && format != "png") || config.Width < 1 || config.Width > 1024 || config.Height < 1 || config.Height > 1024 {
		return nil, "", invalid("Gunakan foto JPG atau PNG dengan ukuran maksimal 1024 × 1024 piksel.")
	}
	return data, "image/" + format, nil
}

func (a *app) saveProfile(w http.ResponseWriter, r *http.Request, user *account) error {
	if user.Demo {
		return fail(403, "Buat akun untuk menyimpan perubahan profil.")
	}
	var body struct {
		contact
		credentials
		CurrentPassword string
		Avatar          *string
	}
	if err := readJSON(w, r, &body, 720<<10); err != nil {
		return err
	}
	if err := body.contact.validate(); err != nil {
		return err
	}
	if err := body.credentials.validateName(); err != nil {
		return err
	}
	changePassword := body.Password != "" || body.Confirmation != ""
	if changePassword {
		if err := body.credentials.validatePassword(); err != nil {
			return err
		}
	}

	var photo []byte
	var mime string
	if body.Avatar != nil {
		var err error
		photo, mime, err = decodeAvatar(*body.Avatar)
		if err != nil {
			return err
		}
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	saved, err := readAccount(tx.QueryRowContext(r.Context(), "SELECT "+accountColumns+" FROM accounts a WHERE id=$1 FOR UPDATE", user.ID))
	if err != nil {
		return err
	}
	if saved == nil {
		return fail(401, "Silakan masuk untuk mengakses Planer.")
	}
	if changePassword || body.Email != saved.Email || body.Phone != saved.phone {
		salt, _, _ := strings.Cut(saved.password.String, ":")
		if body.CurrentPassword == "" || len(body.CurrentPassword) > 512 ||
			subtle.ConstantTimeCompare([]byte(passwordHash(body.CurrentPassword, salt)), []byte(saved.password.String)) != 1 {
			return fail(403, "Masukkan kata sandi saat ini untuk mengubah kontak atau kata sandi.")
		}
	}
	if changePassword {
		saved.password.String = passwordHash(body.Password, hex.EncodeToString(randBytes(16)))
		cookie, _ := r.Cookie(cookieName)
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM sessions WHERE account=$1 AND token<>$2", user.ID, hash(cookie.Value)); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(r.Context(), "UPDATE accounts SET name=$1, username=$2, email=$3, phone=$4, password=$5 WHERE id=$6",
		body.Name, body.Username, body.Email, body.Phone, saved.password, user.ID); err != nil {
		return uniqueError(err, "Email, nomor HP, atau username sudah terdaftar.")
	}
	if body.Avatar != nil {
		revision := int64(0)
		if photo != nil {
			revision = max(timestamp(), saved.AvatarRevision+1)
		}
		saved.AvatarRevision = revision
		if _, err := tx.ExecContext(r.Context(), "UPDATE accounts SET avatar=$1, avatar_type=$2, avatar_revision=$3 WHERE id=$4",
			photo, mime, saved.AvatarRevision, user.ID); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	saved.Name, saved.Username, saved.Email, saved.phone = body.Name, body.Username, body.Email, body.Phone
	return respond(w, 200, ownProfile{saved, saved.phone})
}

func (a *app) avatar(w http.ResponseWriter, r *http.Request, user *account) error {
	var data []byte
	var mime string
	err := a.db.QueryRowContext(r.Context(), `SELECT a.avatar, a.avatar_type FROM accounts a
		WHERE a.id=$1 AND a.avatar IS NOT NULL AND (a.id=$2 OR EXISTS (
			SELECT 1 FROM space_members subject JOIN space_members viewer USING(space)
			WHERE subject.account=a.id AND viewer.account=$2))`, r.PathValue("id"), user.ID).Scan(&data, &mime)
	if errors.Is(err, sql.ErrNoRows) {
		return fail(404, "Foto profil tidak ditemukan.")
	}
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", mime)
	_, err = w.Write(data)
	return err
}
