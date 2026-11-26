import { useId, useState } from 'react';
import { ArrowLeft, CalendarDays, CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, fromKey } from '../shared/dates.js';
import { priorities } from './event-fields.jsx';
import { Feedback, IconButton, spaceHref } from './ui.jsx';

const clockHours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const hourOf = ({ time }) => Number(time.slice(0, 2));

function AgendaHours({ events, period, direction }) {
  const byHour = Map.groupBy(events.filter(({ time }) => time), hourOf);
  return <dl className="agenda-hours" data-direction={direction} key={period}>
    {clockHours.map((hour) => {
      const items = byHour.get(hour % 12 + (period === 'PM' ? 12 : 0));
      return <div className="agenda-hour" key={hour}>
        <dt>{hour}.00 <span aria-hidden="true">:</span></dt>
        <dd>{items ? <ul>{items.map((item) => <li key={item.id}>
          <span>{item.title}</span>{item.time.slice(3) !== '00' && <time dateTime={item.time}>{item.time} WIB</time>}
        </li>)}</ul> : '-'}</dd>
      </div>;
    })}
  </dl>;
}

function AgendaCard({ event, events, expanded, onToggle }) {
  const date = fromKey(event.date);
  const [period, setPeriod] = useState(null);
  const [direction, setDirection] = useState(null);
  const detailId = useId();
  const priority = event.priority || 'none';
  const otherPeriod = period === 'PM' ? 'AM' : 'PM';
  function shiftPeriod(nextDirection) {
    setDirection(nextDirection);
    setPeriod(otherPeriod);
  }
  return <li className="panel agenda-list-card" data-expanded={expanded}>
    <button type="button" className="agenda-card-trigger" aria-expanded={expanded} aria-controls={detailId}
      onClick={() => {
        if (!expanded) {
          setDirection(null);
          setPeriod(event.time && hourOf(event) >= 12 ? 'PM' : 'AM');
        }
        onToggle();
      }}>
      <span className={`agenda-date priority-${priority}`} aria-hidden="true">
        <strong>{Number(event.date.slice(-2))}</strong><small>{formatDate(date, { month: 'short' })}</small>
      </span>
      <span className="agenda-card-copy">
        <strong>{event.title}</strong>
        <time dateTime={event.date}>{formatDate(date, { weekday: 'long' })}<span className="sr-only"> {formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</span> · {event.time ? `${event.time} WIB` : 'Tanpa jam'}</time>
        {priority !== 'none' && <span className={`agenda-priority priority-${priority}`}>{priorities[priority]}</span>}
      </span>
      <span className={`agenda-status${event.done ? ' done' : ''}`}>{event.done && <Check size={14} />} {event.done ? 'Selesai' : 'Belum selesai'}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    <div className="agenda-card-collapse" id={detailId} inert={!expanded}>
      <div>
        {period && <div className="agenda-card-detail">
          {event.notes && <p className="event-notes"><strong>Notes</strong>{event.notes}</p>}
          <div className="agenda-hours-heading">
            <span>Jadwal harian <small>· WIB</small></span>
            <div className="agenda-period" role="group" aria-label="Pilih bagian hari">
              <IconButton label={`Geser ke kiri ke ${otherPeriod}`} onClick={() => shiftPeriod('left')}><ChevronLeft size={17} /></IconButton>
              <strong aria-live="polite">{period}</strong>
              <IconButton label={`Geser ke kanan ke ${otherPeriod}`} onClick={() => shiftPeriod('right')}><ChevronRight size={17} /></IconButton>
            </div>
          </div>
          <AgendaHours events={events} period={period} direction={direction} />
        </div>}
      </div>
    </div>
  </li>;
}

export function AllAgenda({ workspace, error }) {
  const { space, events } = workspace;
  const [expanded, setExpanded] = useState(null);
  const calendar = spaceHref('/dashboard', space.id);
  const months = Map.groupBy(events, ({ date }) => date.slice(0, 7));
  const days = Map.groupBy(events, ({ date }) => date);

  return <main className="page inner-page all-agenda">
    <a className="text-button agenda-back" href={calendar}><ArrowLeft size={16} /> Kembali ke kalender</a>
    <div className="page-heading"><span className="section-icon section-icon-blue"><CalendarRange size={23} /></span>
      <div><h1>Semua agenda</h1><p>{space.name} · {events.length} kegiatan</p></div>
    </div>
    <Feedback error={error} />
    {events.length ? [...months].map(([month, items]) => <section className="agenda-month" key={month}>
      <h2>{formatDate(fromKey(month + '-01'), { month: 'long', year: 'numeric' })}</h2>
      <ul className="agenda-card-grid">{items.map((event) =>
        <AgendaCard key={event.id} event={event} events={days.get(event.date)} expanded={expanded === event.id}
          onToggle={() => setExpanded((current) => current === event.id ? null : event.id)} />)}</ul>
    </section>) : <section className="panel empty-feature">
      <span className="section-icon section-icon-blue"><CalendarDays size={21} /></span>
      <h2>Belum ada agenda</h2>
      <p>Kegiatan yang kamu tambahkan ke kalender akan muncul di sini.</p>
    </section>}
  </main>;
}
