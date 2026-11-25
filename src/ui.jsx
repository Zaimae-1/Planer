import { CalendarCheck2, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';

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

export async function animateOut(element, complete) {
  if (!element || element.hasAttribute('data-closing')) return;
  element.setAttribute('data-closing', '');
  await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
  if (element.isConnected) complete();
}

export function Dialog({ children, className, titleId, close, onEscape }) {
  const ref = useRef(null);
  const outside = useRef(false);
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const dismiss = () => animateOut(ref.current, close);
  return <dialog ref={ref} className={`animated-dialog ${className}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); (onEscape || dismiss)(); }}
    onPointerDown={(event) => { outside.current = !event.target.closest('[data-dialog-panel]'); }}
    onClick={(event) => {
      if (outside.current && !event.target.closest('[data-dialog-panel]')) dismiss();
      outside.current = false;
    }}>
    {children(dismiss)}
  </dialog>;
}

export function Modal({ children, title, close }) {
  const titleId = useId();
  return <Dialog titleId={titleId} className="modal" close={close}>{(dismiss) => (
    <div className="modal-content" data-dialog-panel>
      <div className="modal-heading"><h2 id={titleId}>{title}</h2><IconButton label="Tutup" onClick={dismiss}><X size={19} /></IconButton></div>
      {children(dismiss)}
    </div>
  )}</Dialog>;
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
