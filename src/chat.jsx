import { useEffect, useRef, useState } from 'react';
import { Check, Download, FileAudio2, MessageCircle, Mic, Paperclip, Pin, PinOff, Reply, Send, Smile, Square, UsersRound, Video, X } from 'lucide-react';
import { formatDate } from '../shared/dates.js';
import { useRecording } from './recording.js';
import { api, Avatar, Feedback, IconButton, MemberRow } from './ui.jsx';

const emojis = ['😀', '😂', '😊', '🥳', '🙌', '👍', '❤️', '🔥', '🎉', '✅', '👀', '🙏', '💪', '📅', '✨', '🚀'];
const sizeLimit = 20 * 1024 * 1024;
const preview = (message) => message.body || message.filename || 'Lampiran';

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

function Attachment({ message, src = `/api/messages/${message.id}/media` }) {
  const [failed, setFailed] = useState(false);
  const media = { src, 'aria-label': message.filename, onError: () => setFailed(true) };
  if (failed) return <a className="text-button" href={src} download={message.filename}><Download size={15} /> Unduh {message.filename}</a>;
  if (message.mime.startsWith('image/')) return <a className="image-attachment" href={src} target="_blank" rel="noreferrer"><img {...media} alt={message.filename} loading="lazy" /></a>;
  if (message.mime.startsWith('video/')) return <video {...media} controls playsInline preload="metadata" />;
  return <audio {...media} controls preload="metadata" />;
}

function Message({ message, mine, onReply, onPin }) {
  return <li id={`message-${message.id}`} className={`message-row ${mine ? 'mine' : ''}`}>
    {!mine && <Avatar name={message.name} />}
    <article className="message-bubble">
      {!mine && <strong className="sender">{message.name}</strong>}
      {message.reply && <div className="quoted"><strong>{message.replyName}</strong><span>{message.replyBody || message.replyFile}</span></div>}
      {message.mime && <Attachment message={message} />}
      {message.body && <p>{message.body}</p>}
      <div className="message-time">{message.pinned && <Pin size={12} aria-label="Disematkan" />}<time dateTime={new Date(message.sent).toISOString()}>
        {formatDate(new Date(message.sent), { hour: '2-digit', minute: '2-digit' })}
      </time>{mine && <Check size={13} aria-label="Terkirim" />}</div>
    </article>
    <div className="message-actions">
      <IconButton label={`Balas pesan ${message.name}`} onClick={() => onReply(message)}><Reply size={16} /></IconButton>
      <IconButton label={message.pinned ? 'Lepas sematan' : 'Sematkan pesan'} onClick={() => onPin(message)}>{message.pinned ? <PinOff size={15} /> : <Pin size={15} />}</IconButton>
    </div>
  </li>;
}

function encodeFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ mime: file.type, name: file.name, data: reader.result.split(',')[1] });
    reader.onerror = () => reject(new Error('File tidak bisa dibaca.'));
    reader.readAsDataURL(file);
  });
}

export function Chat({ user, members, space }) {
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [file, setFile] = useState(null);
  const [fileURL, setFileURL] = useState('');
  const [emoji, setEmoji] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = useRef(null);
  const upload = useRef(null);
  const thread = useRef(null);
  const nearBottom = useRef(true);
  const revision = useRef(0);
  const last = messages.at(-1)?.id;
  const pins = messages.filter((message) => message.pinned).sort((a, b) => b.pinned - a.pinned);

  function chooseFile(next) {
    if (!next) return;
    if (!next.type.startsWith('image/') && !next.type.startsWith('audio/') && !next.type.startsWith('video/')) { setError('Pilih foto, video, atau file audio.'); return; }
    if (next.size > sizeLimit || !next.size) { setError('Ukuran lampiran harus antara 1 byte dan 20 MB.'); return; }
    setError('');
    setFile(next);
  }

  const recording = useRecording(chooseFile, setError);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFileURL(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let mounted = true;
    let fetching = false;
    async function read() {
      if (fetching || document.hidden) return;
      fetching = true;
      const current = revision.current;
      try {
        const result = await api('/messages');
        if (mounted && current === revision.current) {
          setMessages(result.messages);
          setLoaded(true);
          setLoadError('');
        }
      } catch (error) { if (mounted && current === revision.current) setLoadError(error.message); }
      finally { fetching = false; }
    }
    read();
    const timer = setInterval(read, 2300);
    document.addEventListener('visibilitychange', read);
    return () => { mounted = false; clearInterval(timer); document.removeEventListener('visibilitychange', read); };
  }, [loadAttempt]);

  useEffect(() => {
    if (nearBottom.current && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [last]);

  function addEmoji(symbol) {
    const input = field.current;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    setText((value) => value.slice(0, start) + symbol + value.slice(end));
    setEmoji(false);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + symbol.length, start + symbol.length); });
  }

  async function send(event) {
    event.preventDefault();
    if (busy || recording.recording || (!file && !text.trim())) return;
    setBusy(true);
    setError('');
    try {
      const attachment = file && await encodeFile(file);
      const result = await api('/messages', 'POST', { text, reply: reply?.id, attachment });
      revision.current++;
      nearBottom.current = true;
      setMessages(result.messages);
      setLoaded(true);
      setLoadError('');
      setText('');
      setReply(null);
      setFile(null);
      setFileURL('');
      setEmoji(false);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); requestAnimationFrame(() => field.current?.focus()); }
  }

  async function togglePin(message) {
    setError('');
    try {
      const result = await api(`/messages/${message.id}/pin`, 'PATCH', { pinned: !message.pinned });
      revision.current++;
      setMessages(result.messages);
    } catch (error) { setError(error.message); }
  }

  return <main className="page inner-page">
    <div className="page-heading"><span className="section-icon section-icon-blue"><MessageCircle size={23} /></span><div><h1>Pesan tim</h1><p>Obrolan dan berkas untuk semua anggota tim.</p></div></div>
    <div className="chat-layout">
      <section className="panel chat-panel" aria-label={`Grup ${space.name}`}>
        <div className="chat-header"><span className="section-icon section-icon-blue"><UsersRound size={22} /></span><div><h2>{space.name}</h2><p>{members.length} anggota · {members.filter((member) => member.online).length} online</p></div></div>
        {pins.length > 0 && <div className="pin-area">
          <button className="pin-bar" aria-expanded={showPins} onClick={() => setShowPins(!showPins)}><Pin size={16} /><span><strong>{pins.length === 1 ? 'Pesan disematkan' : `${pins.length} pesan disematkan`}</strong><small>{preview(pins[0])}</small></span></button>
          {showPins && <ul className="pin-list">{pins.map((message) => <li key={message.id}><button onClick={() => {
            document.getElementById(`message-${message.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setShowPins(false);
          }}>{message.name} · {preview(message)}</button></li>)}</ul>}
        </div>}
        <div className="chat-thread" ref={thread} onScroll={(event) => {
          const el = event.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
        }}>
          {messages.length > 0 ? <ol className="message-list" aria-label="Riwayat obrolan" aria-live="polite">{messages.map((message) =>
            <Message key={message.id} message={message} mine={message.author === user.id} onReply={(selected) => { setReply(selected); field.current?.focus(); }} onPin={togglePin} />)}</ol>
            : !loaded && !loadError ? <ChatSkeleton />
              : <div className="chat-empty">
                <MessageCircle size={29} />
                <p>{loaded ? 'Belum ada pesan. Mulai obrolan dengan tim.' : 'Obrolan belum dapat dimuat.'}</p>
                {!loaded && <button className="button button-secondary" onClick={() => {
                  setLoadError('');
                  setLoadAttempt((attempt) => attempt + 1);
                }}>Coba lagi</button>}
              </div>}
        </div>
        <form className="chat-composer" onSubmit={send}>
          <Feedback error={error || (loaded ? loadError : '')} />
          {reply && <div className="compose-preview"><Reply size={17} /><span><strong>Balas {reply.name}</strong><small>{preview(reply)}</small></span><IconButton label="Batalkan balasan" onClick={() => setReply(null)}><X size={17} /></IconButton></div>}
          {file && <div className="compose-preview">{file.type.startsWith('image/') && fileURL ? <img src={fileURL} alt="" /> : file.type.startsWith('video/') ? <Video size={19} /> : <FileAudio2 size={19} />}
            <span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB</small></span><IconButton label="Lepas lampiran" onClick={() => { setFile(null); setFileURL(''); }}><X size={17} /></IconButton></div>}
          {emoji && <div className="emoji-picker" aria-label="Pilih emoji">{emojis.map((symbol) => <button type="button" key={symbol} onClick={() => addEmoji(symbol)}>{symbol}</button>)}</div>}
          {recording.recording ? <div className="recording-row"><i /><span>Merekam… {Math.floor(recording.seconds / 60)}:{String(recording.seconds % 60).padStart(2, '0')}</span>
            <IconButton label="Batalkan rekaman" onClick={() => recording.stop(true)}><X size={18} /></IconButton>
            <button type="button" className="button button-primary" onClick={() => recording.stop()}><Square size={14} /> Selesai</button></div> :
            <div className="composer-row">
              <input type="file" ref={upload} accept="image/*,video/*,audio/*" hidden onChange={(event) => { chooseFile(event.target.files[0]); event.target.value = ''; }} />
              <IconButton label="Lampirkan foto, video, atau audio" onClick={() => upload.current.click()} disabled={busy}><Paperclip size={20} /></IconButton>
              <IconButton label="Pilih emoji" aria-expanded={emoji} onClick={() => setEmoji(!emoji)} disabled={busy}><Smile size={20} /></IconButton>
              <textarea ref={field} rows={1} aria-label="Tulis pesan" value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder="Tulis pesan…" disabled={busy}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} />
              <IconButton label="Rekam pesan suara" onClick={() => { setError(''); recording.record(); }} disabled={busy || Boolean(file)}><Mic size={20} /></IconButton>
              <button className="button button-primary send-button" aria-label="Kirim pesan" title="Kirim pesan" disabled={busy || (!text.trim() && !file)}><Send size={19} /></button>
            </div>}
        </form>
      </section>
      <section className="panel members chat-members">
        <div className="section-header"><span className="section-icon section-icon-green"><UsersRound size={19} /></span><div><h2>Anggota grup</h2><p>{members.length} anggota</p></div></div>
        <ul className="member-list">{members.map((member) => <MemberRow key={member.id} member={member} me={user.id} />)}</ul>
      </section>
    </div>
  </main>;
}
