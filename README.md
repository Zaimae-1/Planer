# Planer

Planer adalah aplikasi sumber terbuka untuk mengatur agenda pribadi dan tim serta bertukar pesan. Antarmuka memakai React dan Vite, sedangkan API memakai Go dan menyimpan data di PostgreSQL.

## Menjalankan di komputer

Siapkan Go 1.25+, Node.js 20.19+ pada lini 20 atau Node.js 22.12+, dan PostgreSQL. Jika memakai Docker, jalankan `docker compose up -d --wait db` untuk database lokal. Jika sudah punya PostgreSQL, buat database kosong dan pakai URL koneksi yang sesuai.

Untuk PowerShell dengan database dari Compose:

```powershell
npm install
$env:DATABASE_URL = 'postgres://planer:planer_local@localhost:5432/planer?sslmode=disable'
npm run dev
```

Di Bash, gunakan `export DATABASE_URL='postgres://planer:planer_local@localhost:5432/planer?sslmode=disable'` sebelum menjalankan perintah npm. Buka [localhost:5173](http://localhost:5173) untuk mencoba demo atau [localhost:5173/register](http://localhost:5173/register) untuk membuat akun. Skema database dibuat saat API pertama kali menyala.

Untuk menjalankan hasil build pada satu server, jalankan `npm run build` lalu `npm start`. Server Go melayani antarmuka dan API pada [localhost:3001](http://localhost:3001). Variabel `HOST` dan `PORT` mengatur alamat server. Atur `PLANER_HTTPS=1` saat aplikasi disajikan melalui HTTPS untuk mengaktifkan cookie Secure. Rekaman mikrofon memerlukan HTTPS atau localhost.

## Alur penggunaan

- **Akun** bisa dibuat oleh siapa saja. Pengguna masuk memakai email atau nomor HP dan mendapat kalender pribadi.
- **Tim** punya kalender bersama dan grup chat masing-masing. Pilih ruang dari Dashboard atau pakai tombol panah untuk berpindah antar ruang.
- **Undangan** untuk pengguna terdaftar dikirim ke Notifikasi menggunakan username, email, atau nomor HP. Penerima bisa menerima atau menolak. Anggota tim bisa menambahkan agenda, mengobrol, atau mengundang orang lain.
- **Tautan undangan** tersedia untuk penerima yang belum punya akun. Simulasi WhatsApp dan Gmail menampilkan kode enam digit selama 10 menit di Planer. Setelah verifikasi, pengundang dapat membagikan tautan sekali pakai yang berlaku 48 jam.
- **Kalender** menampilkan agenda dalam WIB, libur nasional dan cuti bersama Indonesia untuk 2026–2027, serta pilihan hari peringatan nasional dan internasional. Agenda bisa ditambah, diedit, dihapus, dan ditandai selesai.
- **Pesan** mendukung balasan, sematan, emoji, lampiran hingga 20 MB, dan rekaman pesan suara dari mikrofon. Kalender, status anggota, notifikasi, dan obrolan diperbarui otomatis saat halaman aktif.

Referensi kalender berasal dari [SKB 2026](https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026), [SKB 2027](https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027), dan [daftar peringatan PBB](https://www.un.org/en/observances/list-days-weeks).

## Lisensi

Planer dirilis dengan [lisensi MIT](LICENSE).
