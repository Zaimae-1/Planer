import { useState } from 'react';
import { CalendarDays, Clock3, Flag, Pencil, Plus, Trash2 } from 'lucide-react';
import { categories } from '../shared/dates.js';
import { Feedback, IconButton, Modal } from './ui.jsx';

export function DayDetails({ notes, events, pending, onAdd, onEdit, onToggle, onRemove, error }) {
  return <>
    <Feedback error={error} />
    {notes.length > 0 && <ul className="holiday-list">{notes.map(([name, kind, color]) => <li className={color} key={name}>
      <Flag size={15} /><span><strong>{name}</strong><small>{kind}</small></span>
    </li>)}</ul>}
    {events.length ? <ul className="day-events">{events.map((event) => {
      const done = pending[event.id] ?? event.done;
      return <li key={event.id} className={done ? 'event-done' : ''}>
        <input type="checkbox" checked={done} disabled={Object.hasOwn(pending, event.id)} onChange={() => onToggle(event)} aria-label={`Tandai ${event.title} ${done ? 'belum selesai' : 'selesai'}`} />
        <div><strong>{event.title}</strong><small>{event.time && <><Clock3 size={12} /> {event.time} WIB <b>·</b> </>}{categories[event.category]}</small></div>
        <IconButton label={`Edit ${event.title}`} onClick={() => onEdit(event)}><Pencil size={15} /></IconButton>
        <IconButton label={`Hapus ${event.title}`} onClick={() => onRemove(event)}><Trash2 size={15} /></IconButton>
      </li>;
    })}</ul> : <p className="day-empty"><CalendarDays size={19} /> Belum ada kegiatan.</p>}
    <button className="button button-primary full-width" onClick={onAdd}><Plus size={17} /> Tambah kegiatan</button>
  </>;
}

export function EventForm({ event, close, onSave }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await onSave(event.remove ? null : Object.fromEntries(new FormData(e.currentTarget))); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <Modal title={event.remove ? 'Hapus kegiatan?' : event.id ? 'Edit kegiatan' : 'Tambah kegiatan'} close={close}>
    <form className="form" onSubmit={submit}>
      {event.remove ? <p className="muted">Kegiatan “{event.title}” akan dihapus dari kalender tim.</p> : <>
        <label>Nama kegiatan<input name="title" defaultValue={event.title} maxLength={100} placeholder="Contoh: Briefing tim" required autoFocus /></label>
        <div className="form-row">
          <label>Tanggal<input type="date" name="date" defaultValue={event.date} required /></label>
          <label>Jam <small>(opsional, WIB)</small><input type="time" name="time" defaultValue={event.time} /></label>
        </div>
        <label>Kategori<select name="category" defaultValue={event.category || 'kegiatan'}>
          {Object.entries(categories).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select></label>
      </>}
      <Feedback error={error} />
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={close}>Batal</button>
        <button className={`button ${event.remove ? 'button-danger' : 'button-primary'}`} disabled={busy}>{busy ? 'Memproses…' : event.remove ? 'Hapus kegiatan' : 'Simpan kegiatan'}</button></div>
    </form>
  </Modal>;
}
