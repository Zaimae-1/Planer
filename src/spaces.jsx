import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle, Plus, UsersRound } from 'lucide-react';
import { api, Feedback, IconButton, Modal, spaceHref } from './ui.jsx';

export function SpacePicker({ spaces, current, page, onCreate }) {
  const index = spaces.findIndex(({ id }) => id === current.id);
  function move(offset) {
    const next = spaces[(index + offset + spaces.length) % spaces.length];
    if (next && next.id !== current.id) location.assign(spaceHref(page, next.id));
  }
  return <div className="space-strip">
    <div className="space-identity">
      <span className="section-icon section-icon-blue">{current.kind === 'personal' ? <CalendarDays size={18} /> : <UsersRound size={18} />}</span>
      <div><span className="space-label">RUANG AKTIF</span><strong>{current.name}</strong></div>
    </div>
    <div className="space-actions">
      <div className="space-switcher" role="group" aria-label="Ganti ruang">
        <IconButton label="Ruang sebelumnya" disabled={spaces.length < 2} onClick={() => move(-1)}><ChevronLeft size={18} /></IconButton>
        <span className="space-switcher-name" title={current.name}>{current.name}</span>
        <IconButton label="Ruang berikutnya" disabled={spaces.length < 2} onClick={() => move(1)}><ChevronRight size={18} /></IconButton>
      </div>
      <button className="button button-secondary create-team" onClick={onCreate}><Plus size={17} /> Buat tim</button>
    </div>
  </div>;
}

export function NewTeamForm({ close }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const team = await api('/spaces', 'POST', Object.fromEntries(new FormData(event.currentTarget)));
      location.assign(spaceHref('/dashboard', team.id));
    } catch (error) { setError(error.message); setBusy(false); }
  }
  return <Modal title="Buat tim baru" close={close}>{(dismiss) => (
    <form className="form" onSubmit={submit}>
      <p className="muted">Tim baru mendapat kalender bersama dan grup chat.</p>
      <label>Nama tim<input name="name" placeholder="Contoh: Panitia Gathering" minLength={2} maxLength={60} required autoFocus /></label>
      <Feedback error={error} />
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={dismiss}>Batal</button><button className="button button-primary" disabled={busy}>{busy ? 'Membuat…' : 'Buat tim'}</button></div>
    </form>
  )}</Modal>;
}

export function ChooseTeam({ page, spaces, onCreate }) {
  const teams = spaces.filter(({ kind }) => kind === 'team');
  const chat = page === '/messages';
  return <section className="panel empty-feature">
    <span className="section-icon section-icon-blue">{chat ? <MessageCircle size={21} /> : <UsersRound size={21} />}</span>
    <h1>{chat ? 'Pesan tim' : 'Undang anggota'}</h1>
    <p>{teams.length ? 'Pilih tim yang ingin kamu buka.' : chat ? 'Buat tim untuk memulai grup chat.' : 'Buat tim untuk mulai mengundang anggota.'}</p>
    {teams.length > 0 && <ul className="team-options">{teams.map((team) => <li key={team.id}>
      <a href={spaceHref(page, team.id)}><UsersRound size={17} /> <span>{team.name}</span> <ChevronRight size={17} /></a>
    </li>)}</ul>}
    <button className="button button-primary" onClick={onCreate}><Plus size={16} /> Buat tim baru</button>
  </section>;
}
