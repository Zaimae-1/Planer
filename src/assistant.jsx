import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, CalendarCheck2, Settings2, X } from 'lucide-react';
import { dateKey, fromKey } from '../shared/dates.js';
import { parseAgendaMessage } from './assistant-agenda.js';
import { formatEventTime } from './event-time.js';
import { formatDate, t } from './i18n.js';
import { api, IconButton, spaceHref, spaceName } from './ui.jsx';

function BotFace() {
  return <span className="planer-bot" aria-hidden="true"><span className="planer-bot-screen"><i /><i /></span></span>;
}

function AgendaReceipt({ event, space, close }) {
  const date = formatDate(fromKey(event.date), { dateStyle: 'long' });
  return <div className="assistant-receipt">
    <div><CalendarCheck2 size={16} aria-hidden="true" />{t('Agenda tersimpan', 'Agenda saved')}</div>
    <strong>{event.title}</strong>
    <small>{date} · {spaceName(space)}</small>
    {event.activities?.length > 0 && <ul>{event.activities.map((item, index) =>
      <li key={index}>{formatEventTime(item.time)} · {item.title}</li>)}</ul>}
    <a className="text-button" href={`${spaceHref('/dashboard', space.id)}&date=${event.date}`} onClick={close}>
      {t('Buka di kalender', 'Open in calendar')}<ArrowUpRight size={14} aria-hidden="true" />
    </a>
  </div>;
}

const replyFor = {
  'missing-title': ['Apa judul agendanya?', 'What should I call the agenda?'],
  'missing-date': ['Mau dijadwalkan tanggal berapa?', 'What date should I schedule it for?'],
  'invalid-date': ['Tanggal itu belum valid. Coba tulis seperti “28 Desember”.', 'That date is invalid. Try a date like “28 December”.'],
  'multiple-dates': ['Aku bisa membuat satu agenda per pesan. Kirim satu tanggal dulu.', 'I can create one agenda per message. Send one date first.'],
  'invalid-time': ['Jamnya belum valid. Coba tulis seperti “jam 9 pagi” atau “jam 2.30 PM”.', 'That time is invalid. Try “at 9 AM” or “at 2.30 PM”.'],
  'too-long': ['Pendekkan judul atau nama kegiatannya, lalu kirim lagi.', 'Shorten the agenda title or activity name and send it again.'],
  help: ['Di demo ini, aku bisa membuat agenda dan membaca jadwal di ruang aktif. Coba “ada agenda apa besok?” atau tulis nama kegiatan dan tanggalnya.', 'In this demo, I can create agendas and read the active workspace calendar. Try “what events are tomorrow?” or enter an activity and date.'],
};

export function PlanerAssistant({ workspace, refresh }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState({});
  const [working, setWorking] = useState(false);
  const inProgress = useRef(false);
  const panelId = useId();
  const titleId = useId();
  const launcher = useRef(null);
  const input = useRef(null);
  const log = useRef(null);
  const { space, events } = workspace;
  const example = t('Aku ada acara muncak Merbabu tanggal 28 Des ini', 'Schedule a hike up Merbabu on 28 Dec this year');
  const assistantName = t('Asisten Planer', 'Planer Assistant');

  useEffect(() => {
    if (open) input.current.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (open) log.current.scrollTop = log.current.scrollHeight;
  }, [open, messages, working]);

  function close() {
    setOpen(false);
    launcher.current.focus({ preventScroll: true });
  }

  function reply(message) {
    setMessages((current) => [...current, { role: 'assistant', ...message }]);
  }

  async function send(event) {
    event.preventDefault();
    const message = text.trim();
    if (!message || inProgress.current) return;
    setMessages((current) => [...current, { role: 'user', text: message }]);
    setText('');
    const result = parseAgendaMessage(message, { draft });
    if (result.kind === 'list') {
      const items = events.filter((item) => result.date ? item.date === result.date : item.date >= dateKey()).slice(0, 6);
      reply(items.length ? { items, text: t('Ini agenda di ruang aktif:', 'Here are the agendas in this workspace:') }
        : { text: result.date ? t('Belum ada agenda pada tanggal itu.', 'There are no agendas for that date.') : t('Belum ada agenda mendatang.', 'There are no upcoming agendas.') });
      return;
    }
    if (result.kind !== 'agenda') {
      if (result.kind === 'missing-title') setDraft({ date: result.date });
      if (result.kind === 'missing-date') setDraft({ title: result.title, activities: result.activities });
      if (result.kind === 'invalid-time') setDraft({ title: result.title, date: result.date });
      reply({ text: t(...replyFor[result.kind]) });
      return;
    }

    inProgress.current = true;
    setWorking(true);
    try {
      const saved = await api('/events', 'POST', result.fields, { space: space.id });
      setDraft({});
      await refresh();
      reply({ event: saved });
    } catch (error) {
      reply({ text: t(`Agenda belum tersimpan. ${error.message}`, `The agenda was not saved. ${error.message}`) });
    } finally {
      inProgress.current = false;
      setWorking(false);
    }
  }

  return <div className="assistant-widget" onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <section className="assistant-chat" id={panelId} aria-labelledby={titleId} inert={!open}>
      <header className="assistant-chat-header">
        <BotFace /><div><h2 id={titleId}>{assistantName} <span>Demo</span></h2><p>{spaceName(space)}</p></div>
        <a className="icon-button" href={spaceHref('/settings/ai', space.id)} onClick={close}
          aria-label={t('Pengaturan AI', 'AI settings')} title={t('Pengaturan AI', 'AI settings')}><Settings2 size={18} aria-hidden="true" /></a>
        <IconButton label={t('Tutup chat asisten', 'Close assistant chat')} onClick={close}><X size={19} /></IconButton>
      </header>
      <div className="assistant-chat-log" role="log" aria-label={t('Percakapan asisten', 'Assistant conversation')} ref={log}>
        <div className="assistant-intro">
          <p>{t('Ceritakan kegiatanmu dan kapan waktunya. Aku bisa memasukkannya ke kalender ruang ini.', 'Tell me what you’re planning and when. I can add it to this workspace calendar.')}</p>
          {!messages.length && <button type="button" className="assistant-example" onClick={() => { setText(example); input.current.focus(); }}>{example}<ArrowUpRight size={15} aria-hidden="true" /></button>}
        </div>
        {messages.map((message, index) => <div key={index} className={`assistant-message assistant-message-${message.role}`}>
          <span className="sr-only">{message.role === 'user' ? t('Kamu', 'You') : assistantName}</span>
          {message.event ? <AgendaReceipt event={message.event} space={space} close={close} /> : <>
            <p>{message.text}</p>
            {message.items && <ul className="assistant-agenda-list">{message.items.map((item) => <li key={item.id}>
              <strong>{item.title}</strong><small>{formatDate(fromKey(item.date), { dateStyle: 'medium' })}</small>
            </li>)}</ul>}
          </>}
        </div>)}
        {working && <p className="assistant-working" role="status">{t('Menyimpan agenda…', 'Saving agenda…')}</p>}
      </div>
      <form className="assistant-compose" onSubmit={send}>
        <textarea ref={input} rows={2} value={text} onChange={(event) => setText(event.target.value)} maxLength={600}
          aria-label={t('Pesan untuk asisten', 'Message the assistant')} placeholder={t('Tulis nama kegiatan dan tanggal…', 'Enter an activity and date…')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form.requestSubmit();
            }
          }} />
        <button type="submit" className="button button-primary" aria-label={t('Kirim ke asisten', 'Send to assistant')} disabled={!text.trim() || working}>
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      </form>
    </section>
    <button type="button" className="assistant-launcher" ref={launcher} aria-label={assistantName}
      aria-controls={panelId} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <BotFace />
    </button>
  </div>;
}
