import { useState } from 'react';
import { t } from './i18n.js';
import { ArrowLeft, ArrowRight, CalendarDays, Eye, EyeOff, LockKeyhole, UsersRound } from 'lucide-react';
import { api, Brand, Feedback, IconButton, spaceHref } from './ui.jsx';

function Password({ name, label, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return <label>{label}<span className="password-field">
    <input name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={autoComplete === 'new-password' ? 8 : undefined} maxLength={128} placeholder="••••••••" required />
    <IconButton label={visible ? t("Sembunyikan kata sandi", "Hide password") : t("Tampilkan kata sandi", "Show password")} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</IconButton>
  </span></label>;
}

export function ContactFields({ register = false }) {
  return <>
    {register && <label>{t("Nama lengkap", "Full name")}<input name="name" placeholder={t("Nama lengkapmu", "Your full name")} autoComplete="name" minLength={2} maxLength={70} required /></label>}
    {!register && <label>Username<input name="username" placeholder={t("contoh: naya", "e.g. naya")} autoComplete="off" minLength={3} maxLength={30} required /></label>}
    <label>{t("Alamat Gmail", "Gmail address")}<input name="email" type="email" placeholder={t('nama@gmail.com', 'name@gmail.com')} autoComplete={register ? 'email' : 'off'} maxLength={120} required /></label>
    <div className={register ? 'form-row' : undefined}>
      <label>{t("Nomor HP aktif", "Active phone number")}<input name="phone" type="tel" placeholder="08xxxxxxxxxx" autoComplete={register ? 'tel' : 'off'} minLength={8} maxLength={25} required /></label>
      {register && <label>Username<input name="username" placeholder={t("contoh: zaim", "e.g. zaim")} autoComplete="username" minLength={3} maxLength={30} required /></label>}
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
        <h1>{join ? t("Gabung ke tim", "Join team") : register ? t("Buat akun Planer", "Create a Planer account") : t("Masuk ke Planer", "Sign in to Planer")}</h1>
        <p>{join ? t("Buat akun dari undangan ini untuk membuka kalender tim dan kalender pribadimu.", "Create an account with this invitation to open the team and personal calendars.") : register ? t("Atur jadwal pribadi, buat tim, dan rencanakan kegiatan bersama.", "Manage your schedule, create teams, and plan together.") : t("Buka kalender pribadi dan ruang tim yang kamu ikuti.", "Open your personal calendar and team spaces.")}</p>
        <form className="form auth-form" onSubmit={submit}>
          {(register || join) && <>
            {register ? <ContactFields register /> : <label>{t("Nama lengkap", "Full name")}<input name="name" placeholder={t("Nama lengkapmu", "Your full name")} autoComplete="name" minLength={2} maxLength={70} required /></label>}
            <Password name="password" label={t("Kata sandi", "Password")} autoComplete="new-password" />
            <Password name="confirmation" label={t("Konfirmasi kata sandi", "Confirm password")} autoComplete="new-password" />
          </>}
          {!register && !join && <>
            <label>{t("Gmail atau nomor HP", "Gmail or phone number")}<input name="identifier" autoComplete="username" placeholder={t("nama@gmail.com atau 08xxxxxxxxxx", "name@gmail.com or 08xxxxxxxxxx")} maxLength={120} required /></label>
            <Password name="password" label={t("Kata sandi", "Password")} autoComplete="current-password" />
          </>}
          <Feedback error={error || (join && !inviteToken ? t("Tautan undangan tidak lengkap.", "The invitation link is incomplete.") : '')} />
          <button className="button button-primary full-width" disabled={busy || (join && !inviteToken)}>
            {busy ? t("Memproses…", "Working…") : join ? t("Buat akun dan gabung", "Create an account and join") : register ? t("Daftar", "Sign up") : t("Masuk", "Sign in")} <ArrowRight size={17} />
          </button>
        </form>
        {!join && <div className="auth-bottom">
          <p>{register ? t("Sudah punya akun?", "Already have an account?") : t("Belum punya akun?", "Need an account?")} <a href={register ? '/login' : '/register'}>{register ? t("Masuk", "Sign in") : t("Daftar", "Sign up")}</a></p>
          <button className="text-button" onClick={demo} disabled={busy}><ArrowLeft size={16} /> {t("Buka demo Planer", "Open Planer demo")}</button>
        </div>}
      </div>
    </section>
    <aside className="auth-art" aria-hidden="true">
      <div><span><CalendarDays size={18} /> PLANER</span><p>{t("Satu kalender", "One calendar")}<br />{t("untuk satu tim", "for the whole team")}<span>.</span></p></div>
    </aside>
  </main>;
}
