import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t } from './i18n.js';
import { ChevronDown, FileAudio2, MessageCircle, Mic, Paperclip, Pin, Reply, Send, Smile, Square, UsersRound, Video, X } from 'lucide-react';
import { ChatThread, messagePreview } from './chat-thread.jsx';
import { useRecording } from './recording.js';
import { api, Avatar, avatarUrl, Feedback, IconButton, Modal } from './ui.jsx';

const emojis = ['😀', '😂', '😊', '🥳', '🙌', '👍', '❤️', '🔥', '🎉', '✅', '👀', '🙏', '💪', '📅', '✨', '🚀'];
const sizeLimit = 20 * 1024 * 1024;

function ChatRoster({ members, me }) {
  return <ul className="chat-roster">{members.map((member) => <li key={member.id}>
    <Avatar name={member.name} online={member.online} src={avatarUrl(member)} />
    <div><strong>{member.name}{member.id === me ? t(" (kamu)", " (you)") : ''}</strong><small>{member.email}</small></div>
    <span className={member.online ? 'online' : 'offline'}>{member.online ? 'Online' : 'Offline'}</span>
  </li>)}</ul>;
}

function encodeFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ mime: file.type, name: file.name, data: reader.result.split(',')[1] });
    reader.onerror = () => reject(new Error(t("File tidak bisa dibaca.", "The file could not be read.")));
    reader.readAsDataURL(file);
  });
}

export function Chat({ user, members, space, initialMessages = null }) {
  const [messages, setMessages] = useState(() => initialMessages ?? []);
  const [loaded, setLoaded] = useState(initialMessages !== null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [file, setFile] = useState(null);
  const [fileURL, setFileURL] = useState('');
  const [emoji, setEmoji] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = useRef(null);
  const upload = useRef(null);
  const thread = useRef(null);
  const nearBottom = useRef(true);
  const revision = useRef(0);
  const last = messages.at(-1)?.id;
  const pins = messages.filter((message) => message.pinned).sort((a, b) => b.pinned - a.pinned);
  const online = members.filter((member) => member.online).length;

  function chooseFile(next) {
    if (!next) return;
    if (!next.type.startsWith('image/') && !next.type.startsWith('audio/') && !next.type.startsWith('video/')) { setError(t("Pilih foto, video, atau file audio.", "Choose an image, video, or audio file.")); return; }
    if (next.size > sizeLimit || !next.size) { setError(t("Ukuran lampiran harus antara 1 byte dan 20 MB.", "Attachments must be between 1 byte and 20 MB.")); return; }
    setError('');
    setFile(next);
  }

  const recording = useRecording(chooseFile, setError);
  useLayoutEffect(() => {
    const input = field.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight + 2, 116)}px`;
  }, [text, recording.recording]);

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
        const result = await api('/messages', 'GET', undefined, { space: space.id });
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
  }, [loadAttempt, space.id]);

  useEffect(() => {
    if (nearBottom.current && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [last]);

  function addEmoji(symbol) {
    const input = field.current;
    if (!input) return;
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
      const result = await api('/messages', 'POST', { text, reply: reply?.id, attachment }, { space: space.id });
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
      const result = await api(`/messages/${message.id}/pin`, 'PATCH', { pinned: !message.pinned }, { space: space.id });
      revision.current++;
      setMessages(result.messages);
    } catch (error) { setError(error.message); }
  }

  return <main className="page chat-page">
    <div className="chat-layout">
      <section className="panel chat-panel" aria-label={t(`Grup ${space.name}`, `${space.name} chat`)}>
        <header className="chat-header">
          <span className="section-icon chat-emblem"><MessageCircle size={24} /></span>
          <div className="chat-title"><h1>{space.name}</h1><p>{t(`${members.length} anggota`, `${members.length} members`)} <span aria-hidden="true">·</span> <span className="online">{online} online</span></p></div>
          <IconButton className="chat-members-toggle" label={t("Lihat anggota grup", "View group members")} onClick={() => setShowMembers(true)}><UsersRound size={20} /></IconButton>
        </header>
        {pins.length > 0 && <div className="pin-area">
          <button className="pin-bar" aria-expanded={showPins} onClick={() => setShowPins(!showPins)}>
            <span className="pin-symbol"><Pin size={16} /></span><span className="pin-copy"><strong>{pins.length === 1 ? t("Pesan disematkan", "Pinned message") : t(`${pins.length} pesan disematkan`, `${pins.length} pinned messages`)}</strong><small>{messagePreview(pins[0])}</small></span><ChevronDown size={17} />
          </button>
          {showPins && <ul className="pin-list">{pins.map((message) => <li key={message.id}><button onClick={() => {
            document.getElementById(`message-${message.id}`)?.scrollIntoView({ block: 'center', behavior: 'auto' }); setShowPins(false);
          }}>{message.name} · {messagePreview(message)}</button></li>)}</ul>}
        </div>}
        <ChatThread messages={messages} me={user.id} loaded={loaded} loadError={loadError} thread={thread} nearBottom={nearBottom}
          onReply={(selected) => { setReply(selected); field.current?.focus(); }} onPin={togglePin} retry={() => {
            setLoadError('');
            setLoadAttempt((attempt) => attempt + 1);
          }} />
        <form className="chat-composer" onSubmit={send}>
          <Feedback error={error || (loaded ? loadError : '')} />
          {reply && <div className="compose-preview"><Reply size={17} /><span><strong>{t(`Balas ${reply.name}`, `Reply to ${reply.name}`)}</strong><small>{messagePreview(reply)}</small></span><IconButton label={t("Batalkan balasan", "Cancel reply")} onClick={() => setReply(null)}><X size={17} /></IconButton></div>}
          {file && <div className="compose-preview">{file.type.startsWith('image/') && fileURL ? <img src={fileURL} alt="" /> : file.type.startsWith('video/') ? <Video size={19} /> : <FileAudio2 size={19} />}
            <span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB</small></span><IconButton label={t("Lepas lampiran", "Remove attachment")} onClick={() => { setFile(null); setFileURL(''); }}><X size={17} /></IconButton></div>}
          {emoji && !recording.recording && <div className="emoji-picker" aria-label={t("Pilih emoji", "Choose an emoji")}>{emojis.map((symbol) => <button type="button" key={symbol} onClick={() => addEmoji(symbol)}>{symbol}</button>)}</div>}
          {recording.recording ? <div className="recording-row"><i /><span>{t('Merekam…', 'Recording…')} {Math.floor(recording.seconds / 60)}:{String(recording.seconds % 60).padStart(2, '0')}</span>
            <IconButton label={t("Batalkan rekaman", "Cancel recording")} onClick={() => recording.stop(true)}><X size={18} /></IconButton>
            <button type="button" className="button button-primary" onClick={() => recording.stop()}><Square size={14} /> {t("Selesai", "Done")}</button></div> :
            <div className="composer-row">
              <input type="file" ref={upload} accept="image/*,video/*,audio/*" hidden onChange={(event) => { chooseFile(event.target.files[0]); event.target.value = ''; }} />
              <IconButton label={t("Lampirkan foto, video, atau audio", "Attach a photo, video, or audio file")} onClick={() => upload.current.click()} disabled={busy}><Paperclip size={20} /></IconButton>
              <IconButton label={t("Pilih emoji", "Choose an emoji")} aria-expanded={emoji} onClick={() => setEmoji(!emoji)} disabled={busy}><Smile size={20} /></IconButton>
              <textarea ref={field} rows={1} aria-label={t("Tulis pesan", "Write a message")} value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder={t("Tulis pesan…", "Write a message…")} disabled={busy}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} />
              <IconButton label={t("Rekam pesan suara", "Record voice message")} onClick={() => { setEmoji(false); setError(''); recording.record(); }} disabled={busy || Boolean(file)}><Mic size={20} /></IconButton>
              <button className="button button-primary send-button" aria-label={t("Kirim pesan", "Send message")} title={t("Kirim pesan", "Send message")} disabled={busy || (!text.trim() && !file)}><Send size={19} /></button>
            </div>}
        </form>
      </section>
      <aside className="panel chat-members" aria-labelledby="chat-members-title">
        <div className="section-header"><span className="section-icon section-icon-green"><UsersRound size={19} /></span><div><h2 id="chat-members-title">{t("Anggota grup", "Group members")}</h2><p>{t(`${online} dari ${members.length} anggota online`, `${online} of ${members.length} members online`)}</p></div></div>
        <ChatRoster members={members} me={user.id} />
      </aside>
    </div>
    {showMembers && <Modal title={t("Anggota grup", "Group members")} close={() => setShowMembers(false)}>{() => <ChatRoster members={members} me={user.id} />}</Modal>}
  </main>;
}
