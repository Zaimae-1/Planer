import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, Clock3, Flag, Pencil, Plus, Trash2, X } from 'lucide-react';
import { formatDate, fromKey } from '../shared/dates.js';
import { EventFields, priorities } from './event-fields.jsx';
import { animateOut, Dialog, Feedback, IconButton } from './ui.jsx';

function DayDetails({ holidays, events, pending, onAdd, onEdit, onToggle, onRemove, error, editorOpen, addButton }) {
  return <>
    <Feedback error={error} />
    {holidays.length > 0 && <ul className="holiday-list">{holidays.map(([name, kind, color]) => <li className={color} key={name}>
      <Flag size={15} /><span><strong>{name}</strong><small>{kind}</small></span>
    </li>)}</ul>}
    {events.length ? <ul className="day-events">{events.map((event) => {
      const done = pending[event.id] ?? event.done;
      return <li key={event.id} className={done ? 'event-done' : ''}>
        <input type="checkbox" checked={done} disabled={Object.hasOwn(pending, event.id)} onChange={() => onToggle(event)} aria-label={`Tandai ${event.title} ${done ? 'belum selesai' : 'selesai'}`} />
        <div>
          <strong>{event.title}</strong>
          <small className="event-meta">
            {event.time && <Clock3 size={12} aria-hidden="true" />}{event.time ? `${event.time} WIB` : 'Tanpa jam'}
            {event.priority && event.priority !== 'none' && <span className={`agenda-priority priority-${event.priority}`}>{priorities[event.priority]}</span>}
          </small>
          {event.notes && <p className="event-notes">{event.notes}</p>}
        </div>
        <IconButton label={`Edit ${event.title}`} disabled={editorOpen} onClick={(click) => onEdit(event, click.currentTarget)}><Pencil size={15} /></IconButton>
        <IconButton label={`Hapus ${event.title}`} disabled={editorOpen} onClick={(click) => onRemove(event, click.currentTarget)}><Trash2 size={15} /></IconButton>
      </li>;
    })}</ul> : <p className="day-empty"><CalendarDays size={19} /> Belum ada kegiatan.</p>}
    <button ref={addButton} className="button button-primary full-width" disabled={editorOpen} onClick={onAdd}><Plus size={17} /> Tambah kegiatan</button>
  </>;
}

function EventEditor({ event, panel, close, onSave }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const title = event.remove ? 'Hapus kegiatan?' : event.id ? 'Edit kegiatan' : 'Tambah kegiatan';
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await onSave(event.remove ? null : Object.fromEntries(new FormData(e.currentTarget))); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section className="agenda-editor" ref={panel} aria-labelledby={titleId}>
    <div className="modal-heading"><h3 id={titleId}>{title}</h3></div>
    <form className="form" onSubmit={submit}>
      {event.remove ? <p className="muted">Kegiatan “{event.title}” akan dihapus dari kalender.</p> : <EventFields event={event} />}
      <Feedback error={error} />
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={close} disabled={busy} data-editor-focus={event.remove ? '' : undefined}>Batal</button>
        <button className={`button ${event.remove ? 'button-danger' : 'button-primary'}`} disabled={busy}>{busy ? 'Memproses…' : event.remove ? 'Hapus kegiatan' : 'Simpan kegiatan'}</button></div>
    </form>
  </section>;
}

export function AgendaDialog({ date, startAdding, close, onSave, ...details }) {
  const [editor, setEditor] = useState(() => startAdding ? { date } : null);
  const titleId = useId();
  const overview = useRef(null);
  const surface = useRef(null);
  const closeButton = useRef(null);
  const editorPanel = useRef(null);
  const addButton = useRef(null);
  const editorOpener = useRef(null);
  const previousLayout = useRef(null);
  const movements = useRef([]);

  function rememberLayout() {
    previousLayout.current = {
      left: overview.current.getBoundingClientRect().left,
      width: surface.current.getBoundingClientRect().width,
    };
  }

  function openEditor(form, opener) {
    rememberLayout();
    editorOpener.current = opener;
    setEditor(form);
  }

  function closeEditor() {
    animateOut(editorPanel.current, () => {
      rememberLayout();
      editorOpener.current ??= addButton.current;
      setEditor(null);
    });
  }

  useLayoutEffect(() => {
    const before = previousLayout.current;
    previousLayout.current = null;
    movements.current.forEach((animation) => animation.cancel());
    movements.current = [];
    if (!before || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const panel = overview.current;
    const width = surface.current.getBoundingClientRect().width;
    if (Math.abs(before.width - width) < 1) return;
    const shift = before.left - panel.getBoundingClientRect().left;
    const style = getComputedStyle(panel);
    const options = {
      duration: Number.parseFloat(style.getPropertyValue('--motion-panel')),
      easing: style.getPropertyValue('--motion-ease').trim(),
    };
    movements.current = [
      surface.current.animate([{ transform: `scaleX(${before.width / width})` }, { transform: 'none' }], options),
      panel.animate([{ transform: `translateX(${shift}px)` }, { transform: 'none' }], options),
      closeButton.current.animate([{ transform: `translateX(${(before.width - width) / 2}px)` }, { transform: 'none' }], options),
    ];
  }, [editor]);

  useEffect(() => {
    if (editor) {
      const panel = editorPanel.current;
      const dialog = panel.closest('dialog');
      panel.querySelector('[data-editor-focus]')?.focus({ preventScroll: true });
      if (dialog.scrollHeight > dialog.clientHeight + 1) {
        panel.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    } else if (editorOpener.current) {
      const opener = editorOpener.current;
      (opener.isConnected ? opener : addButton.current)?.focus();
      editorOpener.current = null;
    }
  }, [editor]);

  return <Dialog titleId={titleId} className="agenda-dialog" close={close} onEscape={editor ? closeEditor : undefined}>{(dismiss) => (
    <div className={`agenda-stage${editor ? ' has-editor' : ''}`} data-dialog-panel>
      <div className="agenda-surface" ref={surface} aria-hidden="true" />
      <IconButton ref={closeButton} className="agenda-close" label="Tutup agenda harian" onClick={dismiss}><X size={19} /></IconButton>
      <section className="agenda-main" ref={overview}>
        <div className="modal-heading">
          <div><p className="agenda-caption">Agenda harian</p><h2 id={titleId}>{formatDate(fromKey(date), { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
        </div>
        <DayDetails {...details} editorOpen={Boolean(editor)} addButton={addButton}
          onAdd={(click) => openEditor({ date }, click.currentTarget)}
          onEdit={openEditor}
          onRemove={(event, opener) => openEditor({ ...event, remove: true }, opener)} />
      </section>
      {editor && <EventEditor event={editor} panel={editorPanel} close={closeEditor} onSave={async (fields) => {
        await onSave(editor, fields);
        closeEditor();
      }} />}
    </div>
  )}</Dialog>;
}
