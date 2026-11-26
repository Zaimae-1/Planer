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

export function pageFor(pathname) {
  return pathname.replace(/\/$/, '') || '/dashboard';
}

function animateRoute(element, direction, entering) {
  if (!element?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const horizontal = direction !== 0;
  const axis = horizontal ? 'X' : 'Y';
  const offset = horizontal ? direction * (entering ? 18 : -10) : entering ? 9 : -5;
  const settled = { opacity: 1, transform: `translate${axis}(0)` };
  const hidden = { opacity: 0, transform: `translate${axis}(${offset}px)` };
  const timing = getComputedStyle(element);
  const prefix = horizontal ? '--motion-room' : '--motion-page';
  return element.animate(entering ? [hidden, settled] : [settled, hidden], {
    duration: Number.parseFloat(timing.getPropertyValue(`${prefix}-${entering ? 'in' : 'out'}`)),
    easing: timing.getPropertyValue('--motion-ease').trim(),
    fill: 'both',
  });
}

export function useWorkspace(pathname, content, view) {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [route, setRoute] = useState(() => new URL(location.href));
  const [error, setError] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [switching, setSwitching] = useState(false);
  const active = useRef(spaceFromUrl());
  const currentRoute = useRef(route);
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
        else if (error.status === 403 && active.current) location.replace(location.pathname);
        else setError(messageFor(error));
      } finally {
        if (poll.current === job) poll.current = null;
      }
    })();
    return job.done;
  }, []);

  const navigate = useCallback(async (url, { direction = 0, fromHistory = false, kind } = {}) => {
    if (!authenticated.current) return;
    const previous = currentRoute.current;
    const page = pageFor(url.pathname);
    const newPage = page !== pageFor(previous.pathname) || url.searchParams.get('date') !== previous.searchParams.get('date');
    const space = url.searchParams.get('space');
    const newSpace = space !== active.current && (space !== null || previous.searchParams.has('space'));
    transition.current?.abort();
    motion.current?.cancel();
    if (!newPage && !newSpace) {
      transition.current = null;
      setSwitching(false);
      if (fromHistory) currentRoute.current = url;
      return;
    }

    if (newSpace) {
      poll.current?.controller.abort();
      poll.current = null;
    }
    const controller = new AbortController();
    transition.current = controller;
    setSwitching(newSpace);
    setSwitchError('');
    const timeout = newSpace ? setTimeout(() => controller.abort(new Error('Ruang terlalu lama merespons. Coba lagi.')), 12_000) : undefined;
    const element = newPage ? view.current : content.current;
    try {
      const next = newSpace ? await loadWorkspace(space, controller.signal, page === '/messages' && kind !== 'personal') : null;
      clearTimeout(timeout);
      if (transition.current !== controller) return;
      const exit = animateRoute(element, direction, false);
      motion.current = exit;
      if (exit) await exit.finished.catch(() => {});
      if (transition.current !== controller) return;

      if (!fromHistory) history.pushState(null, '', url);
      currentRoute.current = url;
      if (next) active.current = next.workspace.space.id;
      exit?.cancel();
      flushSync(() => {
        setRoute(url);
        if (next) {
          setData(next);
          setError('');
        }
      });
      if (newPage) {
        if (!fromHistory) window.scrollTo({ top: 0, behavior: 'instant' });
        element?.focus({ preventScroll: true });
      }
      const enter = animateRoute(element, direction, true);
      motion.current = enter;
      if (enter) await enter.finished.catch(() => {});
    } catch (error) {
      if (transition.current !== controller) return;
      if (error.status === 401) location.replace('/login');
      else {
        setSwitchError(messageFor(error));
        if (fromHistory) history.replaceState(null, '', previous);
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
  }, [content, view]);

  const switchSpace = useCallback((target, direction) => {
    const url = new URL(currentRoute.current.pathname, location.origin);
    url.searchParams.set('space', target.id);
    return navigate(url, { direction, kind: target.kind });
  }, [navigate]);

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
    const restoreRoute = () => navigate(new URL(location.href), { fromHistory: true });
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, [navigate]);

  return { user, data, route, error, refresh, switching, switchError, switchSpace, navigate };
}
