import { Fragment, useState } from 'react';
import { formatDate, t } from './i18n.js';
import { Check, Download, MessageCircle, Pin, PinOff, Reply } from 'lucide-react';
import { dateKey, fromKey } from '../shared/dates.js';
import { Avatar, IconButton } from './ui.jsx';

export const messagePreview = (message) => message.body || message.filename || t("Lampiran", "Attachment");

function ChatSkeleton() {
  return <div className="chat-skeleton" role="status">
    <span className="sr-only">{t("Memuat riwayat obrolan…", "Loading chat history…")}</span>
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
  if (failed) return <a className="text-button" href={src} download={message.filename}><Download size={15} /> {t('Unduh', 'Download')} {message.filename}</a>;
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
      <div className="message-time">{message.pinned && <Pin size={12} aria-label={t("Disematkan", "Pinned")} />}<time dateTime={sent.toISOString()}>
        {formatDate(sent, { hour: '2-digit', minute: '2-digit' })}
      </time>{mine && <Check size={13} aria-label={t("Terkirim", "Sent")} />}</div>
    </article>
    <div className="message-actions">
      <IconButton label={t(`Balas pesan ${message.name}`, `Reply to ${message.name}`)} onClick={() => onReply(message)}><Reply size={16} /></IconButton>
      <IconButton label={message.pinned ? t("Lepas sematan", "Unpin message") : t("Sematkan pesan", "Pin message")} onClick={() => onPin(message)}>{message.pinned ? <PinOff size={15} /> : <Pin size={15} />}</IconButton>
    </div>
  </li>;
}

export function ChatThread({ messages, me, loaded, loadError, retry, thread, nearBottom, onReply, onPin }) {
  const today = dateKey();
  return <div className="chat-thread" ref={thread} onScroll={(event) => {
    const el = event.currentTarget;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  }}>
    {messages.length > 0 ? <ol className="message-list" aria-label={t("Riwayat obrolan", "Chat history")} aria-live="polite">
      {messages.map((message, index) => {
        const day = dateKey(new Date(message.sent));
        const firstOfDay = index === 0 || dateKey(new Date(messages[index - 1].sent)) !== day;
        return <Fragment key={message.id}>
          {firstOfDay && <li className="chat-date"><time dateTime={day}>{day === today ? t("Hari ini", "Today") : formatDate(fromKey(day), { dateStyle: 'long' })}</time></li>}
          <Message message={message} mine={message.author === me} onReply={onReply} onPin={onPin} />
        </Fragment>;
      })}
    </ol> : !loaded && !loadError ? <ChatSkeleton /> : <div className="chat-empty">
      <span className="section-icon section-icon-blue"><MessageCircle size={23} /></span>
      <div><strong>{loaded ? t("Belum ada pesan", "No messages yet") : t("Obrolan belum dapat dimuat.", "Chat could not be loaded.")}</strong>
        {loaded && <p>{t("Kirim pesan untuk memulai obrolan tim.", "Send a message to start the team conversation.")}</p>}</div>
      {!loaded && <button className="button button-secondary" onClick={retry}>{t("Coba lagi", "Try again")}</button>}
    </div>}
  </div>;
}
