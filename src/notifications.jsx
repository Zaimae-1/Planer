import { useState } from 'react';
import { ArrowRight, Bell, Check, Mail, X } from 'lucide-react';
import { formatDate } from '../shared/dates.js';
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
    <div className="page-heading"><span className="section-icon section-icon-blue"><Bell size={23} /></span><div><h1>Notifikasi</h1><p>{pendingCount ? `${pendingCount} undangan menunggu jawaban` : 'Undangan untuk bergabung ke tim'}</p></div></div>
    <Feedback error={error || networkError} />
    {items.length ? <ul className="notification-list">{items.map((item) => <li className="panel notification" key={item.id}>
      <span className={`section-icon ${item.status === 'accepted' ? 'section-icon-green' : 'section-icon-blue'}`}><Mail size={21} /></span>
      <div className="notification-copy">
        <h2>{item.spaceName}</h2>
        <p><strong>{item.sender}</strong> mengundangmu ke tim ini.</p>
        <time dateTime={new Date(item.created).toISOString()}>{formatDate(new Date(item.created), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</time>
      </div>
      <div className="notification-actions">
        {item.status === 'pending' ? <>
          <button className="button button-secondary" disabled={busy !== null} onClick={() => respond(item.id, 'decline')}><X size={16} /> Tolak</button>
          <button className="button button-primary" disabled={busy !== null} onClick={() => respond(item.id, 'accept')}><Check size={16} /> Terima</button>
        </> : item.status === 'accepted' ? <><span className="notification-status accepted">Diterima</span><a className="text-button" href={spaceHref('/dashboard', item.spaceId)}>Buka kalender <ArrowRight size={16} /></a></> :
          <span className="notification-status">Ditolak</span>}
      </div>
    </li>)}</ul> : <section className="panel empty-feature">
      <span className="section-icon section-icon-blue"><Bell size={21} /></span>
      <h2>Belum ada notifikasi</h2><p>Undangan yang dikirim ke akunmu akan muncul di sini.</p>
    </section>}
  </main>;
}
