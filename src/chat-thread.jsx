import { Fragment, useState } from 'react';
import { Check, Download, MessageCircle, Pin, PinOff, Reply } from 'lucide-react';
import { dateKey, formatDate, fromKey } from '../shared/dates.js';
import { Avatar, IconButton } from './ui.jsx';

export const messagePreview = (message) => message.body || message.filename || 'Lampiran';

function ChatSkeleton() {
  return <div className="chat-skeleton" role="status">
    <span className="sr-only">Memuat riwayat obrolan…</span>
    <div aria-hidden="true" className="chat-skeleton-rows">
      {['received', 'sent', 'received', 'sent'].map((side, index) => <div key={index} className={`chat-skeleton-row ${side}`}>
        {side === 'received' && <i className="skeleton-block skeleton-avatar" />}
        <div className="skeleton-bubble">
          {side === 'received' && <i className="skeleton-block skeleton-name" />}
          <i className="skeleton-block skeleton-line" />
          {index !== 1 && <i className="skeleton-block skeleton-line short" />}
          <i className="skeleton-block skeleton-time" />
        </div>
      </div>)}
    </div>
  </div>;
}

function Attachment({ message }) {
  const src = `/api/messages/${message.id}/media`;
  const [failed, setFailed] = useState(false);
  const media = { src, 'aria-label': message.filename, onError: () => setFailed(true) };
  if (failed) return <a className="text-button" href={src} download={message.filename}><Download size={15} /> Unduh {message.filename}</a>;
  if (message.mime.startsWith('image/')) return <a className="image-attachment" href={src} target="_blank" rel="noreferrer"><img {...media} alt={message.filename} loading="lazy" /></a>;
  if (message.mime.startsWith('video/')) return <video {...media} controls playsInline preload="metadata" />;
  return <audio {...media} controls preload="metadata" />;
}

function Message({ message, mine, onReply, onPin }) {
  const sent = new Date(message.sent);
  return <li id={`message-${message.id}`} className={`message-row ${mine ? 'mine' : ''}`}>
    {!mine && <Avatar name={message.name} />}
    <article className="message-bubble">
      {!mine && <strong className="sender">{message.name}</strong>}
      {message.reply && <div className="quoted"><strong>{message.replyName}</strong><span>{message.replyBody || message.replyFile}</span></div>}
      {message.mime && <Attachment message={message} />}
      {message.body && <p>{message.body}</p>}
      <div className="message-time">{message.pinned && <Pin size={12} aria-label="Disematkan" />}<time dateTime={sent.toISOString()}>
        {formatDate(sent, { hour: '2-digit', minute: '2-digit' })}
      </time>{mine && <Check size={13} aria-label="Terkirim" />}</div>
    </article>
    <div className="message-actions">
      <IconButton label={`Balas pesan ${message.name}`} onClick={() => onReply(message)}><Reply size={16} /></IconButton>
      <IconButton label={message.pinned ? 'Lepas sematan' : 'Sematkan pesan'} onClick={() => onPin(message)}>{message.pinned ? <PinOff size={15} /> : <Pin size={15} />}</IconButton>
    </div>
  </li>;
}

export function ChatThread({ messages, me, loaded, loadError, retry, thread, nearBottom, onReply, onPin }) {
  const today = dateKey();
  return <div className="chat-thread" ref={thread} onScroll={(event) => {
    const el = event.currentTarget;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  }}>
    {messages.length > 0 ? <ol className="message-list" aria-label="Riwayat obrolan" aria-live="polite">
      {messages.map((message, index) => {
        const day = dateKey(new Date(message.sent));
        const firstOfDay = index === 0 || dateKey(new Date(messages[index - 1].sent)) !== day;
        return <Fragment key={message.id}>
          {firstOfDay && <li className="chat-date"><time dateTime={day}>{day === today ? 'Hari ini' : formatDate(fromKey(day), { dateStyle: 'long' })}</time></li>}
          <Message message={message} mine={message.author === me} onReply={onReply} onPin={onPin} />
        </Fragment>;
      })}
    </ol> : !loaded && !loadError ? <ChatSkeleton /> : <div className="chat-empty">
      <span className="section-icon section-icon-blue"><MessageCircle size={23} /></span>
      <div><strong>{loaded ? 'Belum ada pesan' : 'Obrolan belum dapat dimuat.'}</strong>
        {loaded && <p>Kirim pesan untuk memulai obrolan tim.</p>}</div>
      {!loaded && <button className="button button-secondary" onClick={retry}>Coba lagi</button>}
    </div>}
  </div>;
}
