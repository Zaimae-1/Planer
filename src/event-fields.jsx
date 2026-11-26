import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { dateKey, fromKey, utcDate } from '../shared/dates.js';
import { IconButton } from './ui.jsx';
import { clockPattern, eventActivities, toClock } from './event-time.js';
import { formatDate, t } from './i18n.js';

export const priorities = () => ({ none: t('Biasa', 'Normal'), optional: t('Opsional', 'Optional'), important: 'Important' });

function useFieldMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event) {
      if (!root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current.focus({ preventScroll: true });
  }

  const field = {
    ref: root,
    onBlur: (event) => {
      if (event.relatedTarget && !root.current.contains(event.relatedTarget)) setOpen(false);
    },
    onKeyDown: (event) => {
      if (open && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
  };
  const button = {
    ref: trigger,
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
  };
  return { open, setOpen, close, field, button, menuId };
}

function EventDate({ initial, id }) {
  const weekdays = t(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const [value, setValue] = useState(initial);
  const [month, setMonth] = useState(fromKey(initial));
  const { open, setOpen, field, button, menuId, close } = useFieldMenu();
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const offset = (utcDate(year, monthIndex).getUTCDay() + 6) % 7;
  const dayCount = utcDate(year, monthIndex + 1, 0).getUTCDate();
  const today = dateKey();

  function toggle() {
    if (!open && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = fromKey(value);
      if (Number.isFinite(date.getTime()) && date.getUTCFullYear() > 0 && dateKey(date) === value) setMonth(date);
    }
    setOpen(!open);
  }

  return <div className="event-field" {...field}>
    <label htmlFor={id}>{t('Tanggal', 'Date')}</label>
    <div className="field-with-icon">
      <input id={id} name="date" value={value} onChange={(event) => setValue(event.target.value)}
        placeholder="YYYY-MM-DD" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxLength={10} title={t('Gunakan format YYYY-MM-DD', 'Use YYYY-MM-DD')} required />
      <IconButton label={t('Pilih tanggal', 'Choose date')} {...button} onClick={toggle}><CalendarDays size={17} /></IconButton>
    </div>
    {open && <div className="field-menu event-date-menu" id={menuId} role="group" aria-label={t('Pilih tanggal kegiatan', 'Choose agenda date')}>
      <div className="date-menu-heading">
        <IconButton label={t('Bulan sebelumnya', 'Previous month')} disabled={year === 1 && monthIndex === 0} onClick={() => setMonth(utcDate(year, monthIndex - 1))}><ChevronLeft size={16} /></IconButton>
        <strong aria-live="polite">{formatDate(month, { month: 'long', year: 'numeric' })}</strong>
        <IconButton label={t('Bulan berikutnya', 'Next month')} disabled={year === 9999 && monthIndex === 11} onClick={() => setMonth(utcDate(year, monthIndex + 1))}><ChevronRight size={16} /></IconButton>
      </div>
      <div className="date-menu-days">
        {weekdays.map((weekday) => <small key={weekday} aria-hidden="true">{weekday}</small>)}
        {Array.from({ length: dayCount }, (_, index) => {
          const date = utcDate(year, monthIndex, index + 1);
          const key = dateKey(date);
          return <button type="button" key={key} style={index === 0 ? { gridColumnStart: offset + 1 } : undefined} aria-pressed={key === value}
            aria-current={key === today ? 'date' : undefined} aria-label={formatDate(date, { dateStyle: 'long' })}
            onClick={() => { setValue(key); close(); }}>{index + 1}</button>;
        })}
      </div>
    </div>}
  </div>;
}

function EventPriority({ initial }) {
  const labels = priorities();
  const [value, setValue] = useState(initial || 'none');
  const { open, setOpen, field, button, menuId, close } = useFieldMenu();
  const labelId = useId();
  const valueId = useId();
  const options = useRef(null);

  useEffect(() => {
    if (open) options.current.querySelector('[aria-checked="true"]').focus({ preventScroll: true });
  }, [open]);

  function move(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const choices = [...options.current.children];
    const current = choices.indexOf(document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (current + step + choices.length) % choices.length;
    choices[next].focus();
  }

  return <div className="event-field priority-field" {...field}>
    <span id={labelId} className="event-field-label">{t('Prioritas', 'Priority')}</span>
    <input type="hidden" name="priority" value={value} />
    <button type="button" className="priority-trigger" aria-labelledby={`${labelId} ${valueId}`} aria-haspopup="menu" {...button}
      onClick={() => setOpen(!open)} onKeyDown={(event) => {
        if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault();
          setOpen(true);
        }
      }}>
      <span id={valueId}><i className={`legend-dot priority-${value}`} />{labels[value]}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="field-menu priority-menu" ref={options} id={menuId} role="menu" aria-labelledby={labelId} onKeyDown={move}>
      {Object.entries(labels).map(([key, label]) =>
        <button type="button" role="menuitemradio" tabIndex={-1} key={key} aria-checked={key === value}
          onClick={() => { setValue(key); close(); }}>
          <i className={`legend-dot priority-${key}`} />{label}{key === value && <Check size={15} aria-hidden="true" />}
        </button>)}
    </div>}
  </div>;
}

function EventTime({ time, row, describedBy, index }) {
  const { clock, period } = toClock(time);
  const id = useId();
  return <div className="event-field">
    <label htmlFor={id}><span className="editor-time-label">{t('Jam', 'Time')} <small>{t('(opsional, WIB)', '(optional, WIB)')}</small><span className="sr-only"> {index + 1}</span></span></label>
    <div className="time-controls">
      <input id={id} name={`clock-${row}`} defaultValue={clock} maxLength={5} placeholder="9.00" pattern={clockPattern}
        inputMode="decimal" title={t('Masukkan jam seperti 9.00 atau 12.30.', 'Enter a time like 9.00 or 12.30.')} aria-describedby={describedBy} />
      <fieldset className="time-period">
        <legend className="sr-only">{t('Periode jam', 'Time period')} {index + 1}</legend>
        {['AM', 'PM'].map((value) => <label key={value}>
          <input className="sr-only" type="radio" name={`period-${row}`} value={value} defaultChecked={period === value} />{value}
        </label>)}
      </fieldset>
    </div>
  </div>;
}

export function EventFields({ event }) {
  const dateId = useId();
  const timeHint = useId();
  const [activities, setActivities] = useState(() => eventActivities(event).map((item, key) => ({ ...item, key })));
  const nextKey = useRef(activities.length);
  const list = useRef(null);
  return <>
    <label>{t('Judul agenda', 'Agenda title')}<input name="title" defaultValue={event.title} maxLength={100} placeholder={t('Contoh: Perjalanan ke Surabaya', 'e.g. Trip to Surabaya')} required data-editor-focus /></label>
    <div className="form-row">
      <EventDate initial={event.date} id={dateId} />
      <EventPriority initial={event.priority} />
    </div>
    <fieldset className="event-activities" ref={list}>
      <legend>{t('Rangkaian kegiatan', 'Itinerary')} <small>{t('(opsional)', '(optional)')}</small></legend>
      {activities.length > 0 && <small id={timeHint} className="time-hint">{t('12.00 AM = tengah malam. 12.00 PM = tengah hari.', '12.00 AM is midnight. 12.00 PM is noon.')}</small>}
      {activities.map(({ key, title, time }, index) => <div className="activity-input-row" key={key}>
        <input type="hidden" name="activity" value={key} />
        <label>{t('Kegiatan', 'Activity')} {index + 1}<input name={`activity-${key}`} maxLength={100} defaultValue={title} placeholder={t('Contoh: Berangkat', 'e.g. Depart')} /></label>
        <EventTime time={time} row={key} index={index} describedBy={timeHint} />
        <IconButton label={t(`Hapus kegiatan ${index + 1}`, `Remove activity ${index + 1}`)} onClick={() => {
          setActivities((items) => items.filter((item) => item.key !== key));
          list.current.querySelector('.add-activity').focus();
        }}><X size={16} /></IconButton>
      </div>)}
      <button type="button" className="button button-secondary add-activity" disabled={activities.length >= 24} onClick={() => {
        const key = nextKey.current++;
        setActivities((items) => [...items, { key }]);
        requestAnimationFrame(() => list.current?.querySelector(`[name="activity-${key}"]`)?.focus());
      }}><Plus size={16} />{t('Tambah rincian kegiatan', 'Add activity')}</button>
    </fieldset>
    <label><span className="editor-time-label">{t('Catatan', 'Notes')} <small>{t('(opsional)', '(optional)')}</small></span>
      <textarea name="notes" defaultValue={event.notes} maxLength={1000} rows={2} placeholder={t('Tambahkan catatan untuk agenda ini', 'Add a note for this agenda')} />
    </label>
  </>;
}
