import { CalendarCheck2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export const selectedSpace = new URLSearchParams(location.search).get('space');
export const spaceHref = (path, id) => id ? `${path}?space=${encodeURIComponent(id)}` : path;

export async function api(path, method = 'GET', body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (selectedSpace) headers['X-Planer-Workspace'] = selectedSpace;
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return;
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Server Planer belum dapat dihubungi.');
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status });
  return result;
}

export function Brand({ space } = {}) {
  return <a className="brand" href={spaceHref('/dashboard', space)} aria-label="Planer, dashboard"><span className="brand-icon"><CalendarCheck2 size={22} /></span> planer<span className="brand-dot">.</span></a>;
}

export function Avatar({ name, online, className = '' }) {
  const index = [...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4;
  const letters = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return <span className={`avatar avatar-${index} ${className}`} aria-hidden="true">{letters}{online && <i />}</span>;
}

export function IconButton({ label, children, className = '', ...props }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

export function Modal({ children, title, close }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title"
    onCancel={(event) => { event.preventDefault(); close(); }}
    onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="modal-content">
      <div className="modal-heading"><h2 id="modal-title">{title}</h2><IconButton label="Tutup" onClick={close}><X size={19} /></IconButton></div>
      {children}
    </div>
  </dialog>;
}

export function Feedback({ error }) {
  return error && <p className="feedback" role="alert">{error}</p>;
}

export function MemberRow({ member, me }) {
  return <li className="member-row">
    <Avatar name={member.name} online={member.online} />
    <div><div className="member-name"><strong>{member.name.split(' ')[0]}{member.id === me ? ' (kamu)' : ''}</strong><span aria-hidden="true">·</span>
      <span className={member.online ? 'online' : 'offline'}>Status: {member.online ? 'Online' : 'Offline'}</span></div>
      <small>{member.email}</small></div>
  </li>;
}
