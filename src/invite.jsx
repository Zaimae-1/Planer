import { useState } from 'react';
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
        const verified = await api(`/invites/${request.id}/verify`, 'POST', fields);
        setResult(verified);
      } else if (mode === 'account') {
        await api('/invites', 'POST', fields);
        setResult({ pending: true, identifier: fields.identifier });
      } else {
        const invite = await api('/invites', 'POST', { ...fields, channel });
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
    <div className="page-heading"><span className="section-icon section-icon-blue"><UserRoundPlus size={23} /></span><div><h1>Undang anggota</h1><p>Kirim undangan untuk bergabung ke {space.name}.</p></div></div>
    <div className="invite-grid">
      <section className="panel invite-panel">
        {result?.pending ? <div className="success-state">
          <span className="section-icon section-icon-green"><Check size={23} /></span>
          <h2>Undangan terkirim</h2>
          <p>{result.identifier} bisa menerima atau menolaknya di halaman Notifikasi.</p>
          <button className="button button-secondary" onClick={reset}>Undang lagi</button>
        </div> : result ? <div className="success-state">
          <span className="section-icon section-icon-green"><Check size={23} /></span>
          <h2>Tautan undangan siap</h2>
          <p>Bagikan tautan ini agar penerima bisa membuat akun dan bergabung. Tautan berlaku 48 jam dan dapat digunakan sekali.</p>
          <label className="copy-label">Tautan masuk anggota<input value={link} readOnly onFocus={(event) => event.target.select()} /></label>
          <Feedback error={error} />
          <div className="form-actions">
            <button className="button button-primary" onClick={async () => {
              try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError('Salin tautan langsung dari kolom di atas.'); }
            }}><Clipboard size={17} /> {copied ? 'Tautan disalin' : 'Salin tautan'}</button>
            <button className="button button-secondary" onClick={reset}>Undang lagi</button>
          </div>
        </div> : <form className="form" onSubmit={submit} key={request ? 'verify' : 'create'}>
          <div className="invite-form-heading"><h2>{request ? 'Masukkan kode verifikasi' : 'Penerima undangan'}</h2>
            <p>{request ? `Verifikasi melalui ${channel === 'whatsapp' ? 'WhatsApp' : 'Gmail'} untuk ${request.destination}.` : 'Undang pengguna Planer atau buat tautan untuk orang yang belum punya akun.'}</p></div>
          {!request && <fieldset className="channel-field"><legend>Jenis undangan</legend>
            <label><input type="radio" name="inviteMode" checked={mode === 'account'} onChange={() => { reset(); setMode('account'); }} />Akun Planer</label>
            <label><input type="radio" name="inviteMode" checked={mode === 'guest'} onChange={() => { reset(); setMode('guest'); }} />Tautan undangan</label>
          </fieldset>}
          {!request && mode === 'account' && <label>Username, Gmail, atau nomor HP<input name="identifier" placeholder="contoh: naya atau naya@gmail.com" maxLength={120} required /></label>}
          {!request && mode === 'guest' && <>
            <ContactFields />
            <fieldset className="channel-field"><legend>Metode verifikasi</legend>
              <label><input type="radio" name="method" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} /><MessageCircle size={18} /> WhatsApp</label>
              <label><input type="radio" name="method" checked={channel === 'gmail'} onChange={() => setChannel('gmail')} /><Mail size={18} /> Gmail</label>
            </fieldset>
            <div className="demo-note"><ShieldCheck size={19} /><p>Mode uji coba. Kode akan tampil di Planer. Pengiriman melalui WhatsApp dan Gmail belum terhubung.</p></div>
          </>}
          {request && <>
            <div className="demo-note"><ShieldCheck size={19} /><p>Kode uji coba <strong className="otp-code">{request.code}</strong><small>Berlaku selama 10 menit.</small></p></div>
            <label>Kode verifikasi<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required autoFocus /></label>
          </>}
          <Feedback error={error} />
          <div className="form-actions">
            {request && <button type="button" className="button button-secondary" onClick={reset}>Buat kode baru</button>}
            <button className="button button-primary" disabled={busy}>{busy ? 'Memproses…' : request ? 'Verifikasi dan buat tautan' : mode === 'account' ? 'Kirim undangan' : 'Buat kode undangan'} <ArrowRight size={17} /></button>
          </div>
        </form>}
      </section>
      <section className="panel members">
        <div className="section-header"><span className="section-icon section-icon-green"><UsersRound size={19} /></span><div><h2>Anggota tim</h2><p>{members.length} anggota terdaftar</p></div></div>
        <ul className="member-list">{members.map((member) => <MemberRow key={member.id} member={member} me={user.id} />)}</ul>
      </section>
    </div>
  </main>;
}
