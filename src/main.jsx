import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Bell, CalendarDays, ChevronDown, FlaskConical, LogIn, LogOut, MessageSquare, UserRoundPlus } from 'lucide-react';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/source-sans-3';
import { AllAgenda } from './agenda.jsx';
import { AuthPage } from './auth.jsx';
import { Chat } from './chat.jsx';
import { Dashboard } from './dashboard.jsx';
import { InvitePage } from './invite.jsx';
import { Notifications } from './notifications.jsx';
import { ChooseTeam, NewTeamForm, SpacePicker } from './spaces.jsx';
import { api, Avatar, Brand, Feedback, selectedSpace, spaceHref } from './ui.jsx';
import './styles.css';
import './secondary.css';
import './workspace.css';
import './motion.css';

const pathname = location.pathname.replace(/\/$/, '') || '/';
const activePage = pathname === '/' ? '/dashboard' : pathname;
const authModes = { '/login': 'login', '/register': 'register', '/join': 'join' };
const links = [
  ['/dashboard', 'Dashboard', CalendarDays],
  ['/messages', 'Pesan', MessageSquare],
  ['/notifications', 'Notifikasi', Bell],
  ['/invite', 'Undangan', UserRoundPlus],
];

function Navigation({ user, space, pending }) {
  const [error, setError] = useState('');
  async function logout() {
    setError('');
    try { await api('/logout', 'POST'); location.replace('/login'); }
    catch (error) { setError(error.message); }
  }
  return <aside className="app-sidebar">
    <Brand space={space.id} />
    <nav className="nav-links" aria-label="Navigasi utama">
      {links.map(([url, label, Icon]) =>
        <a href={spaceHref(url, space.id)} key={url} aria-current={activePage === url ? 'page' : activePage === '/agenda' && url === '/dashboard' ? 'location' : undefined}>
          <Icon size={19} aria-hidden="true" /> <span>{label}</span>
          {url === '/notifications' && pending > 0 && <span className="nav-count"><span className="sr-only">Undangan baru </span>{pending > 9 ? '9+' : pending}</span>}
        </a>)}
    </nav>
    {user.demo && <a className="demo-account-link" href="/register">Buat akun <ArrowUpRight size={15} /></a>}
    <div className="header-profile">
      {user.demo && <span className="demo-badge"><FlaskConical size={14} /> Demo</span>}
      <details className="profile-menu">
        <summary>
          <Avatar name={user.name} /><span><strong>{user.name.split(' ')[0]}</strong><small>@{user.username}</small></span><ChevronDown size={15} />
          <span className="sr-only">Menu akun</span>
        </summary>
        <div className="account-menu">
          {user.demo && <>
            <a href="/register"><UserRoundPlus size={16} /> Buat akun</a>
            <a href="/login"><LogIn size={16} /> Masuk</a>
          </>}
          <button onClick={logout}><LogOut size={16} /> Keluar</button>
          <Feedback error={error} />
        </div>
      </details>
    </div>
  </aside>;
}

function WorkspaceApp() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [newTeam, setNewTeam] = useState(false);
  const generation = useRef(0);
  const userLoaded = useRef(false);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const [workspace, spaces, notifications] = await Promise.all([api('/workspace'), api('/spaces'), api('/notifications')]);
      if (current === generation.current) { setData({ workspace, spaces, notifications }); setError(''); }
    } catch (error) {
      if (error.status === 401) location.replace('/login');
      else if (error.status === 403 && selectedSpace) location.replace(activePage);
      else if (current === generation.current) setError(error.message === 'Failed to fetch' ? 'Koneksi ke Planer terputus.' : error.message);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function open() {
      try {
        let profile = await api('/session');
        if (!profile && pathname === '/') profile = await api('/demo', 'POST');
        if (!mounted) return;
        if (!profile) { location.replace('/login'); return; }
        userLoaded.current = true;
        setUser(profile);
        await refresh();
      } catch (error) {
        if (mounted) setError(error.message === 'Failed to fetch' ? 'Koneksi ke Planer terputus.' : error.message);
      }
    }
    open();
    const interval = setInterval(() => { if (!document.hidden && userLoaded.current) refresh(); }, 3200);
    const onVisible = () => { if (!document.hidden && userLoaded.current) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { mounted = false; clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  if (!user || !data) return <main className="loading-page"><Brand />
    {error ? <><Feedback error={error} /><button className="button button-primary" onClick={() => location.reload()}>Coba lagi</button></> : <p role="status">Membuka Planer…</p>}
  </main>;

  const { workspace, spaces, notifications } = data;
  const { space, members } = workspace;
  const pending = notifications.filter(({ status }) => status === 'pending').length;
  const onCreate = () => setNewTeam(true);
  const teamPage = activePage === '/messages' || activePage === '/invite';
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Lewati ke konten</a>
    <Navigation user={user} space={space} pending={pending} />
    <div id="main-content" className="workspace-content" tabIndex={-1}>
      {activePage !== '/notifications' && <div className="space-bar-wrap"><SpacePicker spaces={spaces} current={space} page={activePage} onCreate={onCreate} /></div>}
      {activePage === '/notifications' ? <Notifications items={notifications} refresh={refresh} error={error} />
        : teamPage && space.kind === 'personal' ? <main className="page inner-page"><ChooseTeam page={activePage} spaces={spaces} onCreate={onCreate} /></main>
          : activePage === '/messages' ? <Chat user={user} members={members} space={space} />
            : activePage === '/invite' ? <InvitePage user={user} members={members} space={space} />
              : activePage === '/agenda' ? <AllAgenda workspace={workspace} error={error} />
                : <Dashboard user={user} workspace={workspace} refresh={refresh} networkError={error} />}
    </div>
    {newTeam && <NewTeamForm close={() => setNewTeam(false)} />}
  </div>;
}

createRoot(document.getElementById('root')).render(authModes[pathname] ? <AuthPage mode={authModes[pathname]} /> : <WorkspaceApp />);
