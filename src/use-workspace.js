import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api, spaceFromUrl, spaceHref } from './ui.jsx';

async function loadWorkspace(space, signal, preloadChat = false) {
  const [workspace, spaces, notifications, chat] = await Promise.all([
    api('/workspace', 'GET', undefined, { space, signal }),
    api('/spaces', 'GET', undefined, { signal }),
    api('/notifications', 'GET', undefined, { signal }),
    preloadChat ? api('/messages', 'GET', undefined, { space, signal }).catch(() => null) : null,
  ]);
  if (signal.aborted) throw signal.reason;
  return { workspace, spaces, notifications, initialMessages: chat?.messages ?? null };
}

function messageFor(error) {
  return error.message === 'Failed to fetch' ? 'Koneksi ke Planer terputus.' : error.message;
}

function animateRoute(element, direction, entering) {
  if (!element?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const settled = { opacity: 1, transform: 'translateX(0)' };
  const offset = entering ? direction * 18 : direction * -10;
  const hidden = { opacity: 0, transform: `translateX(${offset}px)` };
  const timing = getComputedStyle(element);
  return element.animate(entering ? [hidden, settled] : [settled, hidden], {
    duration: Number.parseFloat(timing.getPropertyValue(entering ? '--motion-room-in' : '--motion-room-out')),
    easing: timing.getPropertyValue('--motion-ease').trim(),
    fill: 'both',
  });
}

export function useWorkspace(pathname, page, content) {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [switching, setSwitching] = useState(false);
  const active = useRef(spaceFromUrl());
  const authenticated = useRef(false);
  const poll = useRef(null);
  const transition = useRef(null);
  const motion = useRef(null);

  const refresh = useCallback(async (fresh = true) => {
    if (transition.current) return;
    if (fresh && poll.current) await poll.current.done;
    if (transition.current) return;
    if (poll.current) return poll.current.done;

    const controller = new AbortController();
    const job = { controller };
    poll.current = job;
    job.done = (async () => {
      try {
        const next = await loadWorkspace(active.current, controller.signal);
        if (poll.current === job) {
          active.current = next.workspace.space.id;
          setData(next);
          setError('');
        }
      } catch (error) {
        if (poll.current !== job || controller.signal.aborted) return;
        if (error.status === 401) location.replace('/login');
        else if (error.status === 403 && spaceFromUrl()) location.replace(page);
        else setError(messageFor(error));
      } finally {
        if (poll.current === job) poll.current = null;
      }
    })();
    return job.done;
  }, [page]);

  const switchSpace = useCallback(async (target, direction, fromHistory = false) => {
    if (transition.current && !fromHistory) return;
    transition.current?.abort();
    motion.current?.cancel();
    if (target.id === active.current) {
      transition.current = null;
      setSwitching(false);
      return;
    }

    poll.current?.controller.abort();
    poll.current = null;
    const controller = new AbortController();
    transition.current = controller;
    setSwitching(true);
    setSwitchError('');
    const timeout = setTimeout(() => controller.abort(new Error('Ruang terlalu lama merespons. Coba lagi.')), 12_000);
    try {
      const next = await loadWorkspace(target.id, controller.signal, page === '/messages' && target.kind === 'team');
      clearTimeout(timeout);
      if (transition.current !== controller) return;
      const exit = animateRoute(content.current, direction, false);
      motion.current = exit;
      if (exit) await exit.finished.catch(() => {});
      if (transition.current !== controller) return;

      if (!fromHistory) history.pushState(null, '', spaceHref(location.pathname, next.workspace.space.id));
      active.current = next.workspace.space.id;
      exit?.cancel();
      flushSync(() => {
        setData(next);
        setError('');
      });
      const enter = animateRoute(content.current, direction, true);
      motion.current = enter;
      if (enter) await enter.finished.catch(() => {});
    } catch (error) {
      if (transition.current !== controller) return;
      if (error.status === 401) location.replace('/login');
      else {
        setSwitchError(messageFor(error));
        if (fromHistory) history.replaceState(null, '', spaceHref(location.pathname, active.current));
      }
    } finally {
      clearTimeout(timeout);
      if (transition.current === controller) {
        transition.current = null;
        motion.current?.cancel();
        motion.current = null;
        setSwitching(false);
      }
    }
  }, [content, page]);

  useEffect(() => {
    let mounted = true;
    async function open() {
      try {
        let profile = await api('/session');
        if (!profile && pathname === '/') profile = await api('/demo', 'POST');
        if (!mounted) return;
        if (!profile) { location.replace('/login'); return; }
        setUser(profile);
        authenticated.current = true;
        await refresh(false);
      } catch (error) {
        if (mounted) setError(messageFor(error));
      }
    }
    open();
    const pollVisible = () => { if (!document.hidden && authenticated.current) refresh(false); };
    const interval = setInterval(pollVisible, 3200);
    document.addEventListener('visibilitychange', pollVisible);
    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', pollVisible);
      poll.current?.controller.abort();
      poll.current = null;
      transition.current?.abort();
      transition.current = null;
      motion.current?.cancel();
    };
  }, [pathname, refresh]);

  useEffect(() => {
    if (!data) return;
    function restoreSpace() {
      const id = spaceFromUrl();
      switchSpace(data.spaces.find((space) => space.id === id) || { id }, 0, true);
    }
    window.addEventListener('popstate', restoreSpace);
    return () => window.removeEventListener('popstate', restoreSpace);
  }, [data, switchSpace]);

  return { user, data, error, refresh, switching, switchError, switchSpace };
}
