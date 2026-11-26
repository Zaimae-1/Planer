import { useState } from 'react';
import { t } from './i18n.js';
import { ArrowRight, Check, Clipboard, Mail, MessageCircle, ShieldCheck, UserRoundPlus, UsersRound } from 'lucide-react';
import { ContactFields } from './auth.jsx';
import { api, Feedback, MemberRow } from './ui.jsx';

export function InvitePage({ user, members, space }) {
  const [mode, setMode] = useState('account');
  const [channel, setChannel] = useState('whatsapp');
  const [request, setRequest] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const link = result ? `${location.origin}/join#token=${encodeURIComponent(result.token)}` : '';

  async function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setBusy(true);
    try {
      if (request) {
        const verified = await api(`/invites/${request.id}/verify`, 'POST', fields, { space: space.id });
        setResult(verified);
      } else if (mode === 'account') {
        await api('/invites', 'POST', fields, { space: space.id });
        setResult({ pending: true, identifier: fields.identifier });
      } else {
        const invite = await api('/invites', 'POST', { ...fields, channel }, { space: space.id });
        setRequest({ ...invite, destination: channel === 'whatsapp' ? fields.phone : fields.email });
      }
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  function reset() {
    setRequest(null);
    setResult(null);
    setError('');
    setCopied(false);
  }

  return <main className="page inner-page">
    <div className="page-heading"><span className="section-icon section-icon-blue"><UserRoundPlus size={23} /></span><div><h1>{t("Undang anggota", "Invite members")}</h1><p>{t(`Kirim undangan untuk bergabung ke ${space.name}.`, `Invite someone to join ${space.name}.`)}</p></div></div>
    <div className="invite-grid">
      <section className="panel invite-panel">
        {result?.pending ? <div className="success-state">
          <span className="section-icon section-icon-green"><Check size={23} /></span>
          <h2>{t("Undangan terkirim", "Invitation sent")}</h2>
          <p>{t(`${result.identifier} bisa menerima atau menolaknya di halaman Notifikasi.`, `${result.identifier} can accept or decline it on the Notifications page.`)}</p>
          <button className="button button-secondary" onClick={reset}>{t("Undang lagi", "Invite again")}</button>
        </div> : result ? <div className="success-state">
          <span className="section-icon section-icon-green"><Check size={23} /></span>
          <h2>{t("Tautan undangan siap", "Invitation link ready")}</h2>
          <p>{t("Bagikan tautan ini agar penerima bisa membuat akun dan bergabung. Tautan berlaku 48 jam dan dapat digunakan sekali.", "Share this link so the recipient can create an account and join. It expires in 48 hours and can be used once.")}</p>
          <label className="copy-label">{t("Tautan masuk anggota", "Member invitation link")}<input value={link} readOnly onFocus={(event) => event.target.select()} /></label>
          <Feedback error={error} />
          <div className="form-actions">
            <button className="button button-primary" onClick={async () => {
              try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError(t("Salin tautan langsung dari kolom di atas.", "Copy the link from the field above.")); }
            }}><Clipboard size={17} /> {copied ? t("Tautan disalin", "Link copied") : t("Salin tautan", "Copy link")}</button>
            <button className="button button-secondary" onClick={reset}>{t("Undang lagi", "Invite again")}</button>
          </div>
        </div> : <form className="form" onSubmit={submit} key={request ? 'verify' : 'create'}>
          <div className="invite-form-heading"><h2>{request ? t("Masukkan kode verifikasi", "Enter verification code") : t("Penerima undangan", "Invitation recipient")}</h2>
            <p>{request ? t(`Verifikasi untuk ${request.destination}.`, `Verify the code for ${request.destination}.`) : t("Undang pengguna Planer atau buat tautan untuk orang yang belum punya akun.", "Invite a Planer user or create a link for someone without an account.")}</p></div>
          {!request && <fieldset className="channel-field"><legend>{t("Jenis undangan", "Invitation type")}</legend>
            <label><input type="radio" name="inviteMode" checked={mode === 'account'} onChange={() => { reset(); setMode('account'); }} />{t("Akun Planer", "Planer account")}</label>
            <label><input type="radio" name="inviteMode" checked={mode === 'guest'} onChange={() => { reset(); setMode('guest'); }} />{t("Tautan undangan", "Invitation link")}</label>
          </fieldset>}
          {!request && mode === 'account' && <label>{t("Username, Gmail, atau nomor HP", "Username, Gmail, or phone number")}<input name="identifier" placeholder={t("contoh: naya atau naya@gmail.com", "e.g. naya or naya@gmail.com")} maxLength={120} required /></label>}
          {!request && mode === 'guest' && <>
            <ContactFields />
            <fieldset className="channel-field"><legend>{t("Metode verifikasi", "Verification method")}</legend>
              <label><input type="radio" name="method" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} /><MessageCircle size={18} /> WhatsApp</label>
              <label><input type="radio" name="method" checked={channel === 'gmail'} onChange={() => setChannel('gmail')} /><Mail size={18} /> Gmail</label>
            </fieldset>
            <div className="demo-note"><ShieldCheck size={19} /><p>{t("Mode uji coba. Kode akan tampil di Planer. Pengiriman melalui WhatsApp dan Gmail belum terhubung.", "Demo mode. Planer displays the code here. Delivery through WhatsApp and Gmail is pending.")}</p></div>
          </>}
          {request && <>
            <div className="demo-note"><ShieldCheck size={19} /><p>{t("Kode uji coba", "Test code")} <strong className="otp-code">{request.code}</strong><small>{t("Berlaku selama 10 menit.", "Valid for 10 minutes.")}</small></p></div>
            <label>{t("Kode verifikasi", "Verification code")}<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required autoFocus /></label>
          </>}
          <Feedback error={error} />
          <div className="form-actions">
            {request && <button type="button" className="button button-secondary" onClick={reset}>{t("Buat kode baru", "Create a new code")}</button>}
            <button className="button button-primary" disabled={busy}>{busy ? t("Memproses…", "Working…") : request ? t("Verifikasi dan buat tautan", "Verify and create link") : mode === 'account' ? t("Kirim undangan", "Send invitation") : t("Buat kode undangan", "Create invitation code")} <ArrowRight size={17} /></button>
          </div>
        </form>}
      </section>
      <section className="panel members">
        <div className="section-header"><span className="section-icon section-icon-green"><UsersRound size={19} /></span><div><h2>{t("Anggota tim", "Team members")}</h2><p>{t(`${members.length} anggota terdaftar`, `${members.length} registered members`)}</p></div></div>
        <ul className="member-list">{members.map((member) => <MemberRow key={member.id} member={member} me={user.id} />)}</ul>
      </section>
    </div>
  </main>;
}
