import { useId, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, CalendarDays, CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { fromKey } from '../shared/dates.js';
import { priorities } from './event-fields.jsx';
import { agendaStart, eventActivities, formatEventTime, toClock } from './event-time.js';
import { Feedback, IconButton, spaceHref, spaceName } from './ui.jsx';
import { formatDate, t } from './i18n.js';

const clockHours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const hourOf = ({ time }) => Number(time.slice(0, 2));
const wideAgenda = matchMedia('(min-width: 1101px)');
const subscribeColumns = (listener) => {
  wideAgenda.addEventListener('change', listener);
  return () => wideAgenda.removeEventListener('change', listener);
};
const columnCount = () => wideAgenda.matches ? 2 : 1;

function AgendaHours({ events, period, direction }) {
  const byHour = Map.groupBy(events.filter(({ time }) => time), hourOf);
  return <dl className="agenda-hours" data-direction={direction} key={period}>
    {clockHours.map((hour) => {
      const items = byHour.get(hour % 12 + (period === 'PM' ? 12 : 0));
      return <div className="agenda-hour" key={hour}>
        <dt>{hour}.00 <span aria-hidden="true">:</span></dt>
        <dd>{items ? <ul>{items.map((item, index) => <li key={index}>
          <span>{item.title}</span>{item.time.slice(3) !== '00' && <time dateTime={item.time}>{formatEventTime(item.time)}</time>}
        </li>)}</ul> : '-'}</dd>
      </div>;
    })}
  </dl>;
}

function AgendaCard({ event }) {
  const date = fromKey(event.date);
  const start = agendaStart(event);
  const items = eventActivities(event);
  const untimed = items.filter(({ time }) => !time);
  const [expanded, setExpanded] = useState(false);
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
          setPeriod(toClock(start).period);
        }
        setExpanded(!expanded);
      }}>
      <span className={`agenda-date priority-${priority}`} aria-hidden="true">
        <strong>{Number(event.date.slice(-2))}</strong><small>{formatDate(date, { month: 'short' })}</small>
      </span>
      <span className="agenda-card-copy">
        <strong>{event.title}</strong>
        <span className="agenda-card-time">
          <time dateTime={event.date}>{formatDate(date, { weekday: 'long' })}<span className="sr-only"> {formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</span></time>
          {' · '}{start ? <time dateTime={start}>{formatEventTime(start)}</time> : formatEventTime('')}
        </span>
        {priority !== 'none' && <span className={`agenda-priority priority-${priority}`}>{priorities()[priority]}</span>}
      </span>
      <span className={`agenda-status${event.done ? ' done' : ''}`}>{event.done && <Check size={14} />} {event.done ? t('Selesai', 'Done') : t('Belum selesai', 'To do')}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    <div className="agenda-card-collapse" id={detailId} inert={!expanded}>
      <div>
        {period && <div className="agenda-card-detail">
          {event.notes && <p className="event-notes"><strong>{t('Catatan', 'Notes')}</strong>{event.notes}</p>}
          <div className="agenda-hours-heading">
            <span>{t('Rangkaian kegiatan', 'Itinerary')} <small>· WIB</small></span>
            <div className="agenda-period" role="group" aria-label={t('Pilih AM atau PM', 'Choose AM or PM')}>
              <IconButton label={t(`Geser ke kiri ke ${otherPeriod}`, `Move left to ${otherPeriod}`)} onClick={() => shiftPeriod('left')}><ChevronLeft size={17} /></IconButton>
              <strong aria-live="polite">{period}</strong>
              <IconButton label={t(`Geser ke kanan ke ${otherPeriod}`, `Move right to ${otherPeriod}`)} onClick={() => shiftPeriod('right')}><ChevronRight size={17} /></IconButton>
            </div>
          </div>
          <AgendaHours events={items} period={period} direction={direction} />
          {untimed.length > 0 && <div className="agenda-untimed"><strong>{formatEventTime('')}</strong>
            <ul>{untimed.map((item, index) => <li key={index}>{item.title}</li>)}</ul>
          </div>}
        </div>}
      </div>
    </div>
  </li>;
}

export function AllAgenda({ workspace, error }) {
  const { space, events } = workspace;
  const [filter, setFilter] = useState('all');
  const columns = useSyncExternalStore(subscribeColumns, columnCount);
  const calendar = spaceHref('/dashboard', space.id);
  const filtered = filter === 'all' ? events : events.filter((event) => (event.priority || 'none') === filter);
  const months = Map.groupBy(filtered, ({ date }) => date.slice(0, 7));
  const filters = { all: t('Semua', 'All'), ...priorities() };

  return <main className="page inner-page all-agenda">
    <a className="text-button agenda-back" href={calendar}><ArrowLeft size={16} /> {t('Kembali ke kalender', 'Back to calendar')}</a>
    <div className="page-heading"><span className="section-icon section-icon-blue"><CalendarRange size={23} /></span>
      <div><h1>{t('Semua agenda', 'All agendas')}</h1><p>{spaceName(space)} · {filtered.length} {t('agenda', 'agenda items')}</p></div>
    </div>
    <div className="agenda-filters" role="group" aria-label={t('Filter prioritas', 'Filter by priority')}>
      {Object.entries(filters).map(([key, label]) => <button key={key} type="button" className="button button-secondary" aria-pressed={key === filter} onClick={() => setFilter(key)}>
        {key !== 'all' && <i className={`legend-dot priority-${key}`} aria-hidden="true" />}{label}
      </button>)}
    </div>
    <Feedback error={error} />
    {filtered.length ? [...months].map(([month, items]) => <section className="agenda-month" key={month}>
      <h2>{formatDate(fromKey(month + '-01'), { month: 'long', year: 'numeric' })}</h2>
      <div className="agenda-card-grid">{Array.from({ length: columns }, (_, column) => <ul className="agenda-card-column" key={column}>
        {items.filter((_, index) => index % columns === column).map((event) => <AgendaCard key={event.id} event={event} />)}
      </ul>)}</div>
    </section>) : <section className="panel empty-feature">
      <span className="section-icon section-icon-blue"><CalendarDays size={21} /></span>
      <h2>{events.length ? t('Tidak ada agenda dengan prioritas ini', 'No agendas match this priority') : t('Belum ada agenda', 'No agendas yet')}</h2>
      {events.length ? <button type="button" className="button button-secondary" onClick={() => setFilter('all')}>{t('Lihat semua', 'Show all')}</button>
        : <p>{t('Agenda yang kamu tambahkan ke kalender akan muncul di sini.', 'Agendas you add to the calendar will appear here.')}</p>}
    </section>}
  </main>;
}
