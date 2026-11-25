import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock3, Flag, Plus, Sparkles, UsersRound, X } from 'lucide-react';
import { categories, dateKey, formatDate, fromKey, utcDate } from '../shared/dates.js';
import { holidays } from './holidays.js';
import { api, Feedback, IconButton, MemberRow } from './ui.jsx';
import { DayDetails, EventForm } from './events.jsx';

const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const monthLabel = (date) => formatDate(date, { month: 'long', year: 'numeric' });

function Hero({ user, space, onAdd }) {
  return <section className="hero">
    <div className="hero-art" aria-hidden="true" />
    <div className="hero-copy">
      <div className="hero-kicker"><Sparkles size={14} /> {space.kind === 'team' ? 'RUANG PERENCANAAN TIM' : 'RUANG PERENCANAAN PRIBADI'}</div>
      <h1>Halo, {user.name.split(' ')[0]}<span>!</span></h1>
      <p>{space.kind === 'team' ? 'Atur agenda tim dan pantau kegiatan dalam satu kalender.' : 'Atur agenda pribadimu dan pantau kegiatan yang akan datang.'}</p>
      <button className="button button-lime" onClick={onAdd}><Plus size={18} /> Tambah kegiatan</button>
    </div>
  </section>;
}

function ActivitySummary({ events, month, selectDay, today }) {
  const current = events.filter((event) => event.date.startsWith(month));
  const done = current.filter((event) => event.done).length;
  const upcoming = current.filter((event) => !event.done && event.date >= today);
  const percentage = current.length ? Math.round(done / current.length * 100) : 0;
  return <section className="panel summary">
    <div className="section-header"><span className="section-icon section-icon-orange"><Clock3 size={19} /></span><div><h2>Ringkasan agenda</h2><p>{monthLabel(fromKey(month + '-01'))}</p></div></div>
    <div className="summary-progress">
      <div className="progress-heading"><strong>{done} dari {current.length} selesai</strong><span>{percentage}%</span></div>
      <progress value={done} max={current.length || 1} aria-label="Kegiatan selesai" />
    </div>
    <div className="summary-label">AGENDA MENDATANG</div>
    {upcoming.length ? <ul className="agenda-list">{upcoming.slice(0, 7).map((event) => <li key={event.id}>
      <button className="agenda-event" onClick={() => selectDay(event.date)}>
        <span className={`agenda-date ${event.category}`}><strong>{Number(event.date.slice(-2))}</strong><small>{formatDate(fromKey(event.date), { month: 'short' })}</small></span>
        <span className="agenda-info"><strong>{event.title}</strong><small>{event.time ? `${event.time} WIB` : 'Tanpa jam'} <b aria-hidden="true">·</b> {categories[event.category]}</small></span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </li>)}</ul> : <p className="empty-summary">Belum ada agenda mendatang pada bulan ini.</p>}
    <button className="text-button summary-today" onClick={() => selectDay(today)}>Lihat agenda hari ini <ArrowRight size={16} /></button>
  </section>;
}

function Members({ members, user }) {
  return <section className="panel members">
    <div className="section-header"><span className="section-icon section-icon-green"><UsersRound size={19} /></span><div><h2>Anggota tim</h2><p>{members.filter((member) => member.online).length} online dari {members.length} anggota</p></div></div>
    <ul className="member-list">{members.map((member) => <MemberRow key={member.id} member={member} me={user.id} />)}</ul>
  </section>;
}

export function Dashboard({ user, workspace, refresh, networkError }) {
  const today = dateKey();
  const [month, setMonth] = useState(() => fromKey(today.slice(0, 7) + '-01'));
  const [selected, setSelected] = useState(null);
  const [position, setPosition] = useState(null);
  const [form, setForm] = useState(null);
  const [pending, setPending] = useState({});
  const [error, setError] = useState('');
  const calendar = useRef(null);
  const close = useRef(null);
  const dayButtons = useRef(new Map());
  const { events, members, space } = workspace;
  const monthKey = dateKey(month).slice(0, 7);
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const offset = (month.getUTCDay() + 6) % 7;
  const weeks = Math.ceil((offset + utcDate(year, monthIndex + 1, 0).getUTCDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, index) => dateKey(utcDate(year, monthIndex, index + 1 - offset)));
  const grouped = Map.groupBy(events, (event) => event.date);

  function selectDay(key) {
    setMonth(fromKey(key.slice(0, 7) + '-01'));
    setError('');
    setSelected(key);
  }

  function closeDay() {
    const button = dayButtons.current.get(selected);
    setSelected(null);
    button?.focus();
  }

  useEffect(() => {
    if (!selected) return;
    function place() {
      const day = dayButtons.current.get(selected)?.getBoundingClientRect();
      const bounds = calendar.current?.getBoundingClientRect();
      if (!day || !bounds) return;
      const width = Math.min(340, bounds.width - 22);
      const left = day.right + width + 14 < bounds.right ? day.right + 10 : Math.max(bounds.left + 10, day.left - width - 10);
      setPosition({ left: left - bounds.left, top: Math.max(75, Math.min(day.top - bounds.top, bounds.height - 315)), width });
    }
    place();
    close.current?.focus({ preventScroll: true });
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [selected, month]);

  function changeMonth(offset) {
    setSelected(null);
    setMonth(utcDate(year, monthIndex + offset));
  }

  async function toggleEvent(event) {
    const done = !event.done;
    setError('');
    setPending((current) => ({ ...current, [event.id]: done }));
    try {
      await api(`/events/${event.id}`, 'PATCH', { done });
      await refresh();
    } catch (error) {
      setError(error.message);
    } finally {
      setPending((current) => {
        const next = { ...current };
        delete next[event.id];
        return next;
      });
    }
  }

  return <main className="page dashboard">
    <Hero user={user} space={space} onAdd={() => setForm({ date: selected || today })} />
    <Feedback error={networkError} />
    <div className="dashboard-grid">
      <section className="panel calendar" ref={calendar} aria-labelledby="calendar-title">
        <div className="calendar-header">
          <div className="section-header"><span className="section-icon section-icon-blue"><CalendarDays size={21} /></span>
            <div><h2 id="calendar-title">{monthLabel(month)}</h2><p>{space.kind === 'team' ? 'Kalender tim' : 'Kalender pribadi'} · WIB</p></div>
          </div>
          <div className="calendar-actions">
            <button className="button today-button" onClick={() => { setSelected(null); setMonth(fromKey(today.slice(0, 7) + '-01')); }}>Hari ini</button>
            <IconButton label="Bulan sebelumnya" onClick={() => changeMonth(-1)}><ChevronLeft size={19} /></IconButton>
            <IconButton label="Bulan berikutnya" onClick={() => changeMonth(1)}><ChevronRight size={19} /></IconButton>
          </div>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-days">
          {days.map((key, index) => {
            const list = grouped.get(key) || [];
            const notes = holidays(key);
            const inMonth = key.startsWith(monthKey);
            const holidayMarkers = notes.map(([title, , color]) => ({ title, color }));
            const markers = [
              ...holidayMarkers.filter(({ color }) => color !== 'violet'),
              ...list.map((event) => ({ title: event.title, color: event.category })),
              ...holidayMarkers.filter(({ color }) => color === 'violet'),
            ];
            const red = index % 7 === 6 || notes.some(([, , color]) => color === 'red');
            return <button key={key} type="button" ref={(element) => {
              if (element) dayButtons.current.set(key, element);
              else dayButtons.current.delete(key);
            }}
              aria-current={key === today ? 'date' : undefined} aria-expanded={selected === key}
              className={`day ${inMonth ? '' : 'day-outside'} ${key === today ? 'day-today' : ''} ${red ? 'day-red' : ''} ${selected === key ? 'day-selected' : ''}`}
              onClick={() => selected === key ? closeDay() : selectDay(key)}>
              <span className="day-top"><span className="day-number">{Number(key.slice(-2))}</span>{key === today && <span className="today-marker" />}</span>
              <span className="sr-only">{` ${monthLabel(fromKey(key))}, ${list.length} kegiatan${markers.length ? `, ${markers.map(({ title }) => title).join(', ')}` : ''}`}</span>
              <span className="day-markers" aria-hidden="true">{markers.slice(0, 2).map((item, i) => <span className={`day-marker ${item.color}`} key={i}><i /><span>{item.title}</span></span>)}
                {markers.length > 2 && <small>+{markers.length - 2}</small>}
              </span>
            </button>;
          })}
        </div>
        <div className="calendar-footer">
          <span><i className="legend-dot rapat" /> Rapat</span><span><i className="legend-dot kegiatan" /> Kegiatan</span><span><i className="legend-dot tenggat" /> Tenggat</span><span><i className="legend-dot red" /> Libur nasional</span><span><i className="legend-dot orange" /> Cuti bersama</span><span><i className="legend-dot violet" /> Peringatan</span>
        </div>
        {selected && <div className="day-overlay" onKeyDown={(event) => { if (event.key === 'Escape' && !form) closeDay(); }}>
          <button type="button" className="day-dismiss" aria-hidden="true" tabIndex={-1} onClick={closeDay} />
          <div className="day-popover" style={position || undefined}>
            <div className="modal-heading">
              <div><small>AGENDA HARIAN</small><h2>{formatDate(fromKey(selected), { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
              <IconButton ref={close} label="Tutup agenda harian" onClick={closeDay}><X size={18} /></IconButton>
            </div>
            <DayDetails notes={holidays(selected)} events={grouped.get(selected) || []} pending={pending} error={error}
              onAdd={() => setForm({ date: selected })} onEdit={setForm}
              onToggle={toggleEvent}
              onRemove={(event) => setForm({ ...event, remove: true })} />
          </div>
        </div>}
      </section>
      <aside className="dashboard-aside" aria-label="Ringkasan tim">
        <ActivitySummary events={events} month={monthKey} selectDay={selectDay} today={today} />
        {space.kind === 'team' && <Members members={members} user={user} />}
      </aside>
    </div>
    <footer className="page-footer"><CalendarPlus size={16} /> Planer <span>·</span> <Flag size={14} /> <a href="https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026">SKB 2026</a><span>·</span><a href="https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027">SKB 2027</a><span>·</span><a href="https://www.un.org/en/observances/list-days-weeks">Hari internasional PBB</a></footer>
    {form && <EventForm event={form} close={() => setForm(null)} onSave={async (fields) => {
      if (form.remove) {
        await api(`/events/${form.id}`, 'DELETE');
        setForm(null);
        await refresh();
        return;
      }
      await api(form.id ? `/events/${form.id}` : '/events', form.id ? 'PATCH' : 'POST', fields);
      setForm(null);
      selectDay(fields.date);
      await refresh();
    }} />}
  </main>;
}
