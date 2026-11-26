import { useState } from 'react';
import { ArrowRight, Bell, Check, Mail, X } from 'lucide-react';
import { formatDate, t } from './i18n.js';
import { api, Feedback, spaceHref } from './ui.jsx';

export function Notifications({ items, refresh, error: networkError }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const pendingCount = items.filter((item) => item.status === 'pending').length;
  async function respond(id, decision) {
    setError('');
    setBusy(id);
    try {
      await api(`/notifications/${id}`, 'PATCH', { decision });
      await refresh();
    } catch (error) { setError(error.message); }
    finally { setBusy(null); }
  }
  return <main className="page inner-page">
    <div className="page-heading"><span className="section-icon section-icon-blue"><Bell size={23} /></span><div><h1>{t('Notifikasi', 'Notifications')}</h1><p>{pendingCount
      ? t(`${pendingCount} undangan menunggu jawaban`, `${pendingCount} pending invitations`)
      : t('Undangan untuk bergabung ke tim', 'Invitations to join teams')}</p></div></div>
    <Feedback error={error || networkError} />
    {items.length ? <ul className="notification-list">{items.map((item) => <li className="panel notification" key={item.id}>
      <span className={`section-icon ${item.status === 'accepted' ? 'section-icon-green' : 'section-icon-blue'}`}><Mail size={21} /></span>
      <div className="notification-copy">
        <h2>{item.spaceName}</h2>
        <p><strong>{item.sender}</strong> {t('mengundangmu ke tim ini.', 'invited you to this team.')}</p>
        <time dateTime={new Date(item.created).toISOString()}>{formatDate(new Date(item.created), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</time>
      </div>
      <div className="notification-actions">
        {item.status === 'pending' ? <>
          <button className="button button-secondary" disabled={busy !== null} onClick={() => respond(item.id, 'decline')}><X size={16} /> {t('Tolak', 'Decline')}</button>
          <button className="button button-primary" disabled={busy !== null} onClick={() => respond(item.id, 'accept')}><Check size={16} /> {t('Terima', 'Accept')}</button>
        </> : item.status === 'accepted' ? <><span className="notification-status accepted">{t('Diterima', 'Accepted')}</span><a className="text-button" href={spaceHref('/dashboard', item.spaceId)}>{t('Buka kalender', 'Open calendar')} <ArrowRight size={16} /></a></> :
          <span className="notification-status">{t('Ditolak', 'Declined')}</span>}
      </div>
    </li>)}</ul> : <section className="panel empty-feature">
      <span className="section-icon section-icon-blue"><Bell size={21} /></span>
      <h2>{t('Belum ada notifikasi', 'No notifications yet')}</h2><p>{t('Undangan yang dikirim ke akunmu akan muncul di sini.', 'Invitations sent to your account will appear here.')}</p>
    </section>}
  </main>;
}
