import { useEffect, useState } from 'react';
import { ArrowRight, Camera, Globe2, Settings2, Sparkles, UserRound } from 'lucide-react';
import { api, Avatar, avatarUrl, Feedback, spaceHref } from './ui.jsx';
import { setLanguage, t, useLanguage } from './i18n.js';

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ProfileForm({ profile, onSaved }) {
  const [photo, setPhoto] = useState(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const saving = reading || busy;

  async function pickPhoto(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setSaved(false);
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 512 * 1024) {
      setError(t('Pilih foto JPG atau PNG maksimal 512 KB.', 'Choose a JPG or PNG up to 512 KB.'));
      return;
    }
    setReading(true);
    try { setPhoto(await readPhoto(file)); }
    catch { setError(t('Foto tidak bisa dibuka.', 'The photo could not be opened.')); }
    finally { setReading(false); }
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    if (photo !== null) fields.avatar = photo.split(',')[1] || '';
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const updated = await api('/profile', 'PUT', fields);
      onSaved(updated);
      for (const name of ['currentPassword', 'password', 'confirmation']) form.elements[name].value = '';
      setPhoto(null);
      setSaved(true);
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  return <form className="form profile-form" onSubmit={submit} onChange={() => setSaved(false)}>
    <div className="settings-photo">
      <Avatar name={profile.name} src={photo ?? avatarUrl(profile)} />
      <div>
        <label className="button button-secondary photo-picker">
          <Camera size={16} />{t('Pilih foto', 'Choose photo')}
          <input type="file" className="sr-only" accept="image/jpeg,image/png" onChange={pickPhoto} disabled={saving} />
        </label>
        {(photo ?? avatarUrl(profile)) && <button type="button" className="text-button" disabled={saving} onClick={() => { setPhoto(''); setSaved(false); }}>{t('Hapus foto', 'Remove photo')}</button>}
        <p>{t('JPG atau PNG · maksimal 512 KB dan 1024 × 1024 piksel', 'JPG or PNG · up to 512 KB and 1024 × 1024 pixels')}</p>
      </div>
    </div>
    <div className="form-row">
      <label>{t('Nama lengkap', 'Full name')}<input name="name" autoComplete="name" required minLength={2} maxLength={70} defaultValue={profile.name} /></label>
      <label>Username<input name="username" autoComplete="username" required minLength={3} maxLength={30} defaultValue={profile.username} /></label>
      <label>{t('Alamat email', 'Email address')}<input type="email" name="email" autoComplete="email" required maxLength={120} defaultValue={profile.email} /></label>
      <label>{t('Nomor HP', 'Phone number')}<input type="tel" name="phone" autoComplete="tel" required minLength={8} maxLength={25} defaultValue={profile.phone} /></label>
    </div>
    <fieldset className="settings-password">
      <legend>{t('Kata sandi', 'Password')}</legend>
      <label>{t('Kata sandi saat ini', 'Current password')}<input type="password" name="currentPassword" autoComplete="current-password" maxLength={128} /></label>
      <p>{t('Isi kata sandi saat ini jika mengubah email, nomor HP, atau kata sandi.', 'Enter your current password to change your email, phone number, or password.')}</p>
      <div className="form-row">
        <label>{t('Kata sandi baru', 'New password')}<input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} /></label>
        <label>{t('Ulangi kata sandi baru', 'Confirm new password')}<input type="password" name="confirmation" autoComplete="new-password" minLength={8} maxLength={128} /></label>
      </div>
    </fieldset>
    <Feedback error={error} />
    <div className="settings-actions"><p role="status">{saved && t('Profil disimpan.', 'Profile saved.')}</p><button className="button button-primary" disabled={saving}>{busy ? t('Menyimpan…', 'Saving…') : t('Simpan profil', 'Save profile')}</button></div>
  </form>;
}

export function SettingsPage({ user, onProfile, space }) {
  const language = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [languageError, setLanguageError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user.demo) return;
    const controller = new AbortController();
    api('/profile', 'GET', undefined, { signal: controller.signal }).then(setProfile).catch((error) => {
      if (!controller.signal.aborted) setLoadError(error.message);
    });
    return () => controller.abort();
  }, [user.demo]);

  async function choose(value) {
    if (value === language) return;
    setLanguageError('');
    setBusy(true);
    try {
      await api('/profile/language', 'PATCH', { language: value });
      setLanguage(value);
      onProfile((previous) => ({ ...previous, language: value }));
    } catch (problem) { setLanguageError(problem.message); }
    finally { setBusy(false); }
  }

  return <main className="page inner-page settings-page">
    <div className="page-heading"><span className="section-icon section-icon-blue"><Settings2 size={23} /></span><div><h1>{t('Pengaturan', 'Settings')}</h1></div></div>
    <section className="panel settings-panel" aria-labelledby="profile-heading">
      <div className="section-header"><span className="section-icon section-icon-blue"><UserRound size={20} /></span><div><h2 id="profile-heading">{t('Edit profil', 'Edit profile')}</h2><p>@{user.username}</p></div></div>
      {user.demo ? <div className="settings-demo"><p>{t('Buat akun untuk menyimpan foto dan informasi profil.', 'Create an account to save your photo and profile details.')}</p>
        <a href="/register" className="button button-secondary">{t('Buat akun', 'Create account')}</a></div>
        : profile ? <ProfileForm profile={profile} onSaved={(updated) => { setProfile(updated); onProfile(updated); }} />
          : loadError ? <Feedback error={loadError} /> : <p role="status">{t('Memuat profil…', 'Loading profile…')}</p>}
    </section>
    <section className="panel settings-panel" aria-labelledby="language-heading">
      <div className="section-header"><span className="section-icon section-icon-green"><Globe2 size={20} /></span><div><h2 id="language-heading">{t('Bahasa web', 'Website language')}</h2></div></div>
      <div className="language-choices" role="group" aria-labelledby="language-heading">
        {[['id', 'Bahasa Indonesia'], ['en', 'English']].map(([code, label]) =>
          <button key={code} type="button" lang={code} className="button button-secondary" aria-pressed={language === code} disabled={busy} onClick={() => choose(code)}>{label}</button>)}
      </div>
      <Feedback error={languageError} />
    </section>
    <section className="panel settings-panel" aria-labelledby="ai-settings-heading">
      <div className="section-header"><span className="section-icon section-icon-blue"><Sparkles size={20} aria-hidden="true" /></span><div>
        <h2 id="ai-settings-heading">{t('Asisten AI', 'AI assistant')}</h2><p>{t('Konfigurasi API, WhatsApp, dan Gmail.', 'API, WhatsApp, and Gmail configuration.')}</p>
      </div></div>
      <a className="button button-secondary" href={spaceHref('/settings/ai', space.id)}>{t('Pengaturan AI', 'AI settings')}<ArrowRight size={16} aria-hidden="true" /></a>
    </section>
  </main>;
}
