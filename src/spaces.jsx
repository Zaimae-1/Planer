import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle, Plus, UsersRound } from 'lucide-react';
import { api, Feedback, IconButton, Modal, spaceHref, spaceName } from './ui.jsx';
import { t } from './i18n.js';

export function SpacePicker({ spaces, current, switching, onSwitch, onCreate }) {
  const index = spaces.findIndex(({ id }) => id === current.id);
  function move(offset) {
    const next = spaces[(index + offset + spaces.length) % spaces.length];
    if (!switching && next && next.id !== current.id) onSwitch(next, offset);
  }
  return <div className="space-strip">
    <div className="space-identity">
      <span className="section-icon section-icon-blue">{current.kind === 'personal' ? <CalendarDays size={18} /> : <UsersRound size={18} />}</span>
      <div><span className="space-label">{t('RUANG AKTIF', 'CURRENT SPACE')}</span><strong title={spaceName(current)}>{spaceName(current)}</strong></div>
    </div>
    <div className="space-actions">
      <div className="space-switcher" role="group" aria-label={t('Ganti ruang', 'Switch space')} aria-busy={switching}>
        <IconButton label={t('Ruang sebelumnya', 'Previous space')} disabled={spaces.length < 2} aria-disabled={switching || undefined} onClick={() => move(-1)}><ChevronLeft size={18} /></IconButton>
        <span className="space-switcher-name" title={spaceName(current)}>{spaceName(current)}</span>
        <IconButton label={t('Ruang berikutnya', 'Next space')} disabled={spaces.length < 2} aria-disabled={switching || undefined} onClick={() => move(1)}><ChevronRight size={18} /></IconButton>
      </div>
      <span className="sr-only" role="status">{switching ? t('Membuka ruang…', 'Opening space…') : `${t('Ruang aktif', 'Current space')}: ${spaceName(current)}`}</span>
      <button className="button button-secondary create-team" disabled={switching} onClick={onCreate}><Plus size={17} /> {t('Buat tim', 'Create team')}</button>
    </div>
  </div>;
}

export function NewTeamForm({ close, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const team = await api('/spaces', 'POST', Object.fromEntries(new FormData(event.currentTarget)));
      onCreated(team);
    } catch (error) { setError(error.message); setBusy(false); }
  }
  return <Modal title={t('Buat tim baru', 'Create a team')} close={close}>{(dismiss) => (
    <form className="form" onSubmit={submit}>
      <p className="muted">{t('Tim baru mendapat kalender bersama dan grup chat.', 'A new team gets a shared calendar and group chat.')}</p>
      <label>{t('Nama tim', 'Team name')}<input name="name" placeholder={t('Contoh: Panitia Gathering', 'e.g. Event committee')} minLength={2} maxLength={60} required autoFocus /></label>
      <Feedback error={error} />
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={dismiss}>{t('Batal', 'Cancel')}</button><button className="button button-primary" disabled={busy}>{busy ? t('Membuat…', 'Creating…') : t('Buat tim', 'Create team')}</button></div>
    </form>
  )}</Modal>;
}

export function ChooseTeam({ page, spaces, onCreate }) {
  const teams = spaces.filter(({ kind }) => kind === 'team');
  const chat = page === '/messages';
  return <section className="panel empty-feature">
    <span className="section-icon section-icon-blue">{chat ? <MessageCircle size={21} /> : <UsersRound size={21} />}</span>
    <h1>{chat ? t('Pesan tim', 'Team messages') : t('Undang anggota', 'Invite members')}</h1>
    <p>{teams.length ? t('Pilih tim yang ingin kamu buka.', 'Choose a team to open.') : chat
      ? t('Buat tim untuk memulai grup chat.', 'Create a team to start a group chat.')
      : t('Buat tim untuk mulai mengundang anggota.', 'Create a team to invite members.')}</p>
    {teams.length > 0 && <ul className="team-options">{teams.map((team) => <li key={team.id}>
      <a href={spaceHref(page, team.id)}><UsersRound size={17} /> <span>{team.name}</span> <ChevronRight size={17} /></a>
    </li>)}</ul>}
    <button className="button button-primary" onClick={onCreate}><Plus size={16} /> {t('Buat tim baru', 'Create a team')}</button>
  </section>;
}
