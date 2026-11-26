package main

import (
	"net/http"
	"time"
)

func (a *app) demo(w http.ResponseWriter, _ *http.Request, user *account) error {
	if user != nil {
		return respond(w, 200, user)
	}
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	id := randomToken()
	user = &account{ID: id, Name: "Zaim Ramadhan", Username: "zaim", Email: "zaim@example.com", Demo: true, Language: "id"}
	people := []struct {
		id, name, username string
		example            int
	}{
		{id, user.Name, user.Username, 0},
		{randomToken(), "Naya Putri", "naya", 1},
		{randomToken(), "Bagas Pratama", "bagas", 1},
		{randomToken(), "Dewi Lestari", "dewi", 2},
	}
	for _, person := range people {
		if _, err := tx.Exec("INSERT INTO accounts (id,name,username,email,phone,demo,example) VALUES ($1,$2,$3,$4,'',TRUE,$5)",
			person.id, person.name, person.username, person.username+"@example.com", person.example); err != nil {
			return err
		}
	}
	if _, err := createSpace(tx, id, "Kalender pribadi", "personal"); err != nil {
		return err
	}
	team, err := createSpace(tx, id, "Tim Kreatif", "team")
	if err != nil {
		return err
	}
	for _, person := range people[1:] {
		if _, err := tx.Exec("INSERT INTO space_members VALUES ($1,$2)", team.ID, person.id); err != nil {
			return err
		}
	}
	today := time.Now().In(time.FixedZone("WIB", 7*60*60))
	remaining := time.Date(today.Year(), today.Month()+1, 0, 0, 0, 0, 0, today.Location()).Day() - today.Day()
	agenda := []struct {
		offset                int
		time, title, priority string
		done                  bool
	}{
		{-17, "13:30", "Susun konsep acara", "none", true}, {-13, "19:00", "Rapat koordinasi", "none", true},
		{-8, "10:00", "Daftar kebutuhan tim", "important", true}, {-5, "16:00", "Survei lokasi", "optional", true},
		{0, "09:00", "Briefing tim", "important", false}, {0, "15:30", "Review konsep", "optional", false},
		{min(2, remaining), "12:00", "Finalisasi rundown", "important", false},
		{min(4, remaining), "14:00", "Gladi bersih", "optional", false}, {7, "10:00", "Evaluasi persiapan", "none", false},
	}
	for _, item := range agenda {
		e := event{ID: randomToken(), Date: today.AddDate(0, 0, item.offset).Format(time.DateOnly),
			Time: item.time, Title: item.title, Priority: item.priority, Done: item.done}
		if err := insertEvent(tx, team.ID, e); err != nil {
			return err
		}
	}
	now := timestamp()
	first := randomToken()
	if _, err := tx.Exec("INSERT INTO messages (id, team, author, body, reply, sent, pinned) VALUES ($1,$2,$3,$4,NULL,$5,$6),($7,$2,$8,$9,$1,$10,NULL),($11,$2,$12,$13,NULL,$14,NULL)",
		first, team.ID, people[1].id, "Halo semua! Jadwal persiapan sudah aku masukkan ke kalender ya. 🙌", now-240000, now-200000,
		randomToken(), people[2].id, "Siap! Kita bahas rundown bareng pas briefing.", now-150000,
		randomToken(), id, "Oke, tolong cek agenda hari ini sebelum mulai ya!", now-60000); err != nil {
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
