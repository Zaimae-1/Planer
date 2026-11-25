import { useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Eye, EyeOff, LockKeyhole, UsersRound } from 'lucide-react';
import { api, Brand, Feedback, IconButton, spaceHref } from './ui.jsx';

function Password({ name, label, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return <label>{label}<span className="password-field">
    <input name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={autoComplete === 'new-password' ? 8 : undefined} maxLength={128} placeholder="••••••••" required />
    <IconButton label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</IconButton>
  </span></label>;
}

export function ContactFields({ register = false }) {
  return <>
    {register && <label>Nama lengkap<input name="name" placeholder="Nama lengkapmu" autoComplete="name" minLength={2} maxLength={70} required /></label>}
    {!register && <label>Username<input name="username" placeholder="contoh: naya" autoComplete="off" minLength={3} maxLength={30} required /></label>}
    <label>Alamat Gmail<input name="email" type="email" placeholder="nama@gmail.com" autoComplete={register ? 'email' : 'off'} maxLength={120} required /></label>
    <div className={register ? 'form-row' : undefined}>
      <label>Nomor HP aktif<input name="phone" type="tel" placeholder="08xxxxxxxxxx" autoComplete={register ? 'tel' : 'off'} minLength={8} maxLength={25} required /></label>
      {register && <label>Username<input name="username" placeholder="contoh: zaim" autoComplete="username" minLength={3} maxLength={30} required /></label>}
    </div>
  </>;
}

export function AuthPage({ mode }) {
  const register = mode === 'register';
  const join = mode === 'join';
  const inviteToken = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      const result = await api(`/${mode}`, 'POST', join ? { ...fields, token: inviteToken } : fields);
      location.replace(spaceHref('/dashboard', result.spaceId));
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }
  async function demo(event) {
    event.preventDefault();
    setBusy(true);
    try { await api('/demo', 'POST'); location.assign('/dashboard'); }
    catch (error) { setError(error.message); setBusy(false); }
  }

  return <main className="auth-layout">
    <section className="auth-form-side">
      <Brand />
      <div className="auth-content">
        <div className="section-icon section-icon-blue">{join ? <UsersRound size={23} /> : <LockKeyhole size={22} />}</div>
        <h1>{join ? 'Gabung ke tim' : register ? 'Buat akun Planer' : 'Masuk ke Planer'}</h1>
        <p>{join ? 'Buat akun dari undangan ini untuk membuka kalender tim dan kalender pribadimu.' : register ? 'Atur jadwal pribadi, buat tim, dan rencanakan kegiatan bersama.' : 'Buka kalender pribadi dan ruang tim yang kamu ikuti.'}</p>
        <form className="form auth-form" onSubmit={submit}>
          {(register || join) && <>
            {register ? <ContactFields register /> : <label>Nama lengkap<input name="name" placeholder="Nama lengkapmu" autoComplete="name" minLength={2} maxLength={70} required /></label>}
            <Password name="password" label="Kata sandi" autoComplete="new-password" />
            <Password name="confirmation" label="Konfirmasi kata sandi" autoComplete="new-password" />
          </>}
          {!register && !join && <>
            <label>Gmail atau nomor HP<input name="identifier" autoComplete="username" placeholder="nama@gmail.com atau 08xxxxxxxxxx" maxLength={120} required /></label>
            <Password name="password" label="Kata sandi" autoComplete="current-password" />
          </>}
          <Feedback error={error || (join && !inviteToken ? 'Tautan undangan tidak lengkap.' : '')} />
          <button className="button button-primary full-width" disabled={busy || (join && !inviteToken)}>
            {busy ? 'Memproses…' : join ? 'Buat akun dan gabung' : register ? 'Daftar' : 'Masuk'} <ArrowRight size={17} />
          </button>
        </form>
        {!join && <div className="auth-bottom">
          <p>{register ? 'Sudah punya akun?' : 'Belum punya akun?'} <a href={register ? '/login' : '/register'}>{register ? 'Masuk' : 'Daftar'}</a></p>
          <button className="text-button" onClick={demo} disabled={busy}><ArrowLeft size={16} /> Buka demo Planer</button>
        </div>}
      </div>
    </section>
    <aside className="auth-art" aria-hidden="true">
      <div><span><CalendarDays size={18} /> PLANER</span><p>Satu kalender<br />untuk satu tim<span>.</span></p></div>
    </aside>
  </main>;
}
