import { ArrowLeft, CalendarDays, CalendarRange, Check, ChevronRight } from 'lucide-react';
import { categories, formatDate, fromKey } from '../shared/dates.js';
import { Feedback, spaceHref } from './ui.jsx';

function AgendaCard({ event, calendar }) {
  const date = fromKey(event.date);
  return <li>
    <a className="panel agenda-list-card" href={`${calendar}&date=${encodeURIComponent(event.date)}`}>
      <span className={`agenda-date ${event.category}`} aria-hidden="true">
        <strong>{Number(event.date.slice(-2))}</strong><small>{formatDate(date, { month: 'short' })}</small>
      </span>
      <div className="agenda-card-copy">
        <h3>{event.title}</h3>
        <time dateTime={event.date}>{formatDate(date, { weekday: 'long' })}<span className="sr-only"> {formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</span> · {event.time ? `${event.time} WIB` : 'Tanpa jam'}</time>
        <span className={`agenda-category ${event.category}`}>{categories[event.category]}</span>
      </div>
      <span className={`agenda-status${event.done ? ' done' : ''}`}>{event.done && <Check size={14} />} {event.done ? 'Selesai' : 'Belum selesai'}</span>
      <ChevronRight size={18} aria-hidden="true" />
    </a>
  </li>;
}

export function AllAgenda({ workspace, error }) {
  const { space, events } = workspace;
  const calendar = spaceHref('/dashboard', space.id);
  const months = Map.groupBy(events, ({ date }) => date.slice(0, 7));

  return <main className="page inner-page all-agenda">
    <a className="text-button agenda-back" href={calendar}><ArrowLeft size={16} /> Kembali ke kalender</a>
    <div className="page-heading"><span className="section-icon section-icon-blue"><CalendarRange size={23} /></span>
      <div><h1>Semua agenda</h1><p>{space.name} · {events.length} kegiatan</p></div>
    </div>
    <Feedback error={error} />
    {events.length ? [...months].map(([month, items]) => <section className="agenda-month" key={month}>
      <h2>{formatDate(fromKey(month + '-01'), { month: 'long', year: 'numeric' })}</h2>
      <ul className="agenda-card-grid">{items.map((event) => <AgendaCard key={event.id} event={event} calendar={calendar} />)}</ul>
    </section>) : <section className="panel empty-feature">
      <span className="section-icon section-icon-blue"><CalendarDays size={21} /></span>
      <h2>Belum ada agenda</h2>
      <p>Kegiatan yang kamu tambahkan ke kalender akan muncul di sini.</p>
    </section>}
  </main>;
}
