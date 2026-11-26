import { useState } from 'react';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock3, Flag, List, Plus, Sparkles, UsersRound } from 'lucide-react';
import { dateKey, formatDate, fromKey, utcDate } from '../shared/dates.js';
import { holidays } from './holidays.js';
import { api, Feedback, IconButton, MemberRow, spaceHref } from './ui.jsx';
import { AgendaDialog } from './events.jsx';
import { priorities } from './event-fields.jsx';

const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const monthLabel = (date) => formatDate(date, { month: 'long', year: 'numeric' });

function linkedDate() {
  const key = new URLSearchParams(location.search).get('date');
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = fromKey(key);
  return Number.isFinite(date.valueOf()) && dateKey(date) === key ? key : null;
}

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
        <span className={`agenda-date priority-${event.priority || 'none'}`}><strong>{Number(event.date.slice(-2))}</strong><small>{formatDate(fromKey(event.date), { month: 'short' })}</small></span>
        <span className="agenda-info"><strong>{event.title}</strong><small>{event.time ? `${event.time} WIB` : 'Tanpa jam'}
          {event.priority && event.priority !== 'none' && ` · ${priorities[event.priority]}`}</small></span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </li>)}</ul> : <p className="empty-summary">Belum ada agenda mendatang pada bulan ini.</p>}
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
  const [agenda, setAgenda] = useState(() => {
    const date = linkedDate();
    return date ? { date, fromLink: true } : null;
  });
  const [month, setMonth] = useState(() => fromKey((agenda?.date || today).slice(0, 7) + '-01'));
  const [pending, setPending] = useState({});
  const [error, setError] = useState('');
  const { events, members, space } = workspace;
  const monthKey = dateKey(month).slice(0, 7);
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const offset = (month.getUTCDay() + 6) % 7;
  const weeks = Math.ceil((offset + utcDate(year, monthIndex + 1, 0).getUTCDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, index) => dateKey(utcDate(year, monthIndex, index + 1 - offset)));
  const grouped = Map.groupBy(events, (event) => event.date);

  function selectDay(key, startAdding = false) {
    setMonth(fromKey(key.slice(0, 7) + '-01'));
    setError('');
    setAgenda({ date: key, startAdding });
  }

  function closeAgenda() {
    if (agenda.fromLink) {
      const url = new URL(location.href);
      url.searchParams.delete('date');
      history.replaceState(history.state, '', url);
      requestAnimationFrame(() => document.querySelector(`.day[data-date="${agenda.date}"]`)?.focus());
    }
    setAgenda(null);
  }

  async function toggleEvent(event) {
    const done = !event.done;
    setError('');
    setPending((current) => ({ ...current, [event.id]: done }));
    try {
      await api(`/events/${event.id}`, 'PATCH', { done }, { space: space.id });
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

  async function saveEvent(form, fields) {
    if (form.remove) {
      await api(`/events/${form.id}`, 'DELETE', undefined, { space: space.id });
    } else {
      if (form.id) {
        const changes = Object.fromEntries(Object.entries(fields).filter(([name, value]) => (form[name] ?? '') !== value));
        if (!Object.keys(changes).length) return;
        await api(`/events/${form.id}`, 'PATCH', changes, { space: space.id });
      } else {
        await api('/events', 'POST', fields, { space: space.id });
      }
      if (fields.date !== agenda.date) {
        setAgenda((current) => current && { ...current, date: fields.date });
        setMonth(fromKey(fields.date.slice(0, 7) + '-01'));
      }
    }
    await refresh();
  }

  return <main className="page dashboard">
    <Hero user={user} space={space} onAdd={() => selectDay(today, true)} />
    <Feedback error={networkError} />
    <div className="dashboard-grid">
      <section className="panel calendar" aria-labelledby="calendar-title">
        <div className="calendar-header">
          <div className="section-header"><span className="section-icon section-icon-blue"><CalendarDays size={21} /></span>
            <div><h2 id="calendar-title">{monthLabel(month)}</h2><p>{space.kind === 'team' ? 'Kalender tim' : 'Kalender pribadi'} · WIB</p></div>
          </div>
          <div className="calendar-actions">
            <button className="button today-button" onClick={() => setMonth(fromKey(today.slice(0, 7) + '-01'))}>Hari ini</button>
            <IconButton label="Bulan sebelumnya" onClick={() => setMonth(utcDate(year, monthIndex - 1))}><ChevronLeft size={19} /></IconButton>
            <IconButton label="Bulan berikutnya" onClick={() => setMonth(utcDate(year, monthIndex + 1))}><ChevronRight size={19} /></IconButton>
          </div>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-days">
          {days.map((key, index) => {
            const list = grouped.get(key) || [];
            const dayHolidays = holidays(key);
            const inMonth = key.startsWith(monthKey);
            const priority = ['important', 'optional'].find((level) => list.some((event) => event.priority === level)) || 'none';
            const holidayMarkers = dayHolidays.map(([title, , color]) => ({ title, color }));
            const markers = [
              ...holidayMarkers.filter(({ color }) => color !== 'violet'),
              ...list.map((event) => ({ title: event.title, color: `priority-${event.priority || 'none'}` })),
              ...holidayMarkers.filter(({ color }) => color === 'violet'),
            ];
            const red = index % 7 === 6 || dayHolidays.some(([, , color]) => color === 'red');
            return <button key={key} type="button" aria-haspopup="dialog" data-date={key} data-priority={priority}
              aria-current={key === today ? 'date' : undefined}
              className={`day ${inMonth ? '' : 'day-outside'} ${key === today ? 'day-today' : ''} ${red ? 'day-red' : ''}`}
              onClick={() => selectDay(key)}>
              <span className="day-top"><span className="day-number">{Number(key.slice(-2))}</span>{key === today && <span className="today-marker" />}</span>
              <span className="sr-only">{` ${monthLabel(fromKey(key))}, ${list.length} kegiatan${priority !== 'none' ? `, ${priorities[priority]}` : ''}${markers.length ? `, ${markers.map(({ title }) => title).join(', ')}` : ''}`}</span>
              <span className="day-markers" aria-hidden="true">{markers.slice(0, 2).map((item, i) => <span className={`day-marker ${item.color}`} key={i}><i /><span>{item.title}</span></span>)}
                {markers.length > 2 && <small>+{markers.length - 2}</small>}
              </span>
            </button>;
          })}
        </div>
        <div className="calendar-footer">
          <div className="calendar-legend">
            <span><i className="legend-dot priority-optional" /> Opsional</span><span><i className="legend-dot priority-important" /> Important</span>
            <span><i className="legend-dot red" /> Libur nasional</span><span><i className="legend-dot orange" /> Cuti bersama</span><span><i className="legend-dot violet" /> Peringatan</span>
          </div>
          <a className="button calendar-list-link" href={spaceHref('/agenda', space.id)}><List size={16} aria-hidden="true" /> Semua agenda</a>
        </div>
      </section>
      <aside className="dashboard-aside" aria-label="Ringkasan tim">
        <ActivitySummary events={events} month={monthKey} selectDay={selectDay} today={today} />
        {space.kind === 'team' && <Members members={members} user={user} />}
      </aside>
    </div>
    <footer className="page-footer"><CalendarPlus size={16} /> Planer <span>·</span> <Flag size={14} /> <a href="https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026">SKB 2026</a><span>·</span><a href="https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027">SKB 2027</a><span>·</span><a href="https://www.un.org/en/observances/list-days-weeks">Hari internasional PBB</a></footer>
    {agenda && <AgendaDialog date={agenda.date} startAdding={agenda.startAdding} close={closeAgenda}
      holidays={holidays(agenda.date)} events={grouped.get(agenda.date) || []} pending={pending}
      error={error} onToggle={toggleEvent} onSave={saveEvent} />}
  </main>;
}
