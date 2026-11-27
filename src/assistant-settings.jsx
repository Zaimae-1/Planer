import { useState } from 'react';
import { ArrowLeft, KeyRound, Mail, MessageCircle, Plug, ShieldCheck } from 'lucide-react';
import { t } from './i18n.js';
import { Feedback, spaceHref } from './ui.jsx';

const channels = [
  { id: 'whatsapp', name: 'WhatsApp', Icon: MessageCircle },
  { id: 'gmail', name: 'Gmail', Icon: Mail },
];

function loadSettings(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}

function demoCode(channel) {
  const random = crypto.getRandomValues(new Uint32Array(1))[0];
  return { channel, code: String(random % 1_000_000).padStart(6, '0'), expires: Date.now() + 5 * 60_000 };
}

export function AssistantSettings({ user, space }) {
  const key = `planer-assistant:${user.id}`;
  const [settings, setSettings] = useState(() => loadSettings(key));
  const [challenge, setChallenge] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [otpError, setOtpError] = useState('');

  function storeSettings(update) {
    const next = { ...settings, ...update };
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setSettings(next);
      return true;
    } catch {
      setError(t('Pengaturan demo tidak bisa disimpan di browser ini.', 'This browser could not save the demo settings.'));
      return false;
    }
  }

  function saveProvider(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    setSaved(storeSettings({ provider: data.get('provider').trim(), model: data.get('model').trim() }));
  }

  function toggle(channel) {
    setOtpError('');
    setError('');
    if (challenge?.channel === channel) setChallenge(null);
    else if (settings.links?.[channel]) storeSettings({ links: { ...settings.links, [channel]: false } });
    else setChallenge(demoCode(channel));
  }

  function verify(event) {
    event.preventDefault();
    if (Date.now() >= challenge.expires) {
      setOtpError(t('Kode demo kedaluwarsa. Buat kode baru.', 'The demo code expired. Generate a new code.'));
      return;
    }
    if (String(new FormData(event.currentTarget).get('code')).trim() !== challenge.code) {
      setOtpError(t('Kode belum cocok.', 'The code does not match.'));
      return;
    }
    if (storeSettings({ links: { ...settings.links, [challenge.channel]: true } })) {
      setChallenge(null);
      setOtpError('');
    }
  }

  return <main className="page inner-page settings-page">
    <a className="text-button agenda-back" href={spaceHref('/settings', space.id)}><ArrowLeft size={16} />{t('Kembali ke pengaturan', 'Back to settings')}</a>
    <div className="page-heading"><span className="section-icon section-icon-blue"><Plug size={23} aria-hidden="true" /></span><div>
      <h1>{t('Pengaturan AI', 'AI settings')}</h1>
      <p>{t('Konfigurasi asisten dan simulasi koneksi MCP.', 'Configure the assistant and try the MCP connection demo.')}</p>
    </div></div>
    <section className="panel settings-panel" aria-labelledby="assistant-api-title">
      <div className="section-header"><span className="section-icon section-icon-blue"><KeyRound size={19} aria-hidden="true" /></span>
        <div><h2 id="assistant-api-title">{t('Konfigurasi API', 'API configuration')}</h2><p>{t('Simpan pilihan penyedia dan model di browser untuk integrasi nanti.', 'Save your provider and model choices in this browser for future integration.')}</p></div>
      </div>
      <form className="form" onSubmit={saveProvider} onChange={() => setSaved(false)}>
        <div className="form-row">
          <label>{t('Penyedia', 'Provider')}<input name="provider" defaultValue={settings.provider || ''} maxLength={60} placeholder="OpenAI" /></label>
          <label>{t('Model', 'Model')}<input name="model" defaultValue={settings.model || ''} maxLength={100} placeholder={t('Nama model', 'Model name')} /></label>
        </div>
        <label>{t('Kunci API', 'API key')}<input disabled type="password" placeholder={t('Tersedia saat API aktif', 'Available when the API is enabled')} /></label>
        <div className="settings-actions"><p role="status">{saved && t('Konfigurasi demo disimpan.', 'Demo configuration saved.')}</p>
          <button type="submit" className="button button-primary">{t('Simpan konfigurasi', 'Save configuration')}</button>
        </div>
      </form>
    </section>
    <section className="panel settings-panel" aria-labelledby="assistant-links-title">
      <div className="section-header"><span className="section-icon section-icon-green"><Plug size={20} aria-hidden="true" /></span>
        <div><h2 id="assistant-links-title">{t('Koneksi MCP', 'MCP connections')}</h2><p>{t('Kode OTP demo tampil di sini. Planer tidak mengirim pesan atau email.', 'Demo OTPs appear here. Planer sends no messages or emails.')}</p></div>
      </div>
      <Feedback error={error} />
      <ul className="assistant-connections">
        {channels.map(({ id, name, Icon }) => {
          const enabled = Boolean(settings.links?.[id]);
          const pending = challenge?.channel === id;
          return <li key={id} className="assistant-connection">
            <div className="assistant-connection-row">
              <span className="section-icon section-icon-blue"><Icon size={19} aria-hidden="true" /></span>
              <span><strong>{name}</strong><small role="status">{pending ? t('Menunggu verifikasi', 'Awaiting verification')
                : enabled ? t('Aktif · demo', 'On · demo') : t('Nonaktif', 'Off')}</small></span>
              <button type="button" role="switch" className="assistant-switch" aria-checked={enabled} aria-label={`${name} demo`}
                onClick={() => toggle(id)}><span /></button>
            </div>
            {pending && <form className="form assistant-otp" key={challenge.code} onSubmit={verify}>
              <div className="demo-note"><ShieldCheck size={18} aria-hidden="true" /><p>{t('Kode demo', 'Demo code')} <strong className="otp-code">{challenge.code}</strong>
                <small>{t('Berlaku selama 5 menit.', 'Valid for 5 minutes.')}</small></p></div>
              <label>{t('Masukkan kode OTP', 'Enter OTP')}<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>
              <Feedback error={otpError} />
              <div className="form-actions">
                <button type="button" className="text-button" onClick={() => { setChallenge(demoCode(id)); setOtpError(''); }}>{t('Buat kode baru', 'Generate new code')}</button>
                <button className="button button-primary">{t('Verifikasi demo', 'Verify demo')}</button>
              </div>
            </form>}
          </li>;
        })}
      </ul>
    </section>
  </main>;
}
