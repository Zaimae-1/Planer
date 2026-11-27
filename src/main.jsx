import React, { useEffect, useId, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Bell, BookOpen, CalendarDays, ChevronDown, FlaskConical, LogOut, MessageSquare, Settings2, UserRoundPlus } from 'lucide-react';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/source-sans-3';
import { AllAgenda } from './agenda.jsx';
import { PlanerAssistant } from './assistant.jsx';
import { AssistantSettings } from './assistant-settings.jsx';
import { AuthPage } from './auth.jsx';
import { Chat } from './chat.jsx';
import { Dashboard } from './dashboard.jsx';
import { InvitePage } from './invite.jsx';
import { Notifications } from './notifications.jsx';
import { NotesPage } from './notes.jsx';
import { SettingsPage } from './settings.jsx';
import { ChooseTeam, NewTeamForm, SpacePicker } from './spaces.jsx';
import { api, Avatar, avatarUrl, Brand, Feedback, spaceHref } from './ui.jsx';
import { t, useLanguage } from './i18n.js';
import { pageFor, useWorkspace } from './use-workspace.js';
import './styles.css';
import './secondary.css';
import './workspace.css';
import './pages.css';
import './assistant.css';
import './motion.css';

const pathname = location.pathname.replace(/\/$/, '') || '/';
const authModes = { '/login': 'login', '/register': 'register', '/join': 'join' };
const links = [
  ['/dashboard', 'Dashboard', 'Dashboard', CalendarDays],
  ['/notes', 'Catatan', 'Notes', BookOpen],
  ['/messages', 'Pesan', 'Messages', MessageSquare],
  ['/notifications', 'Notifikasi', 'Notifications', Bell],
  ['/invite', 'Undangan', 'Invitations', UserRoundPlus],
];
const appPages = new Set(['/agenda', '/settings', '/settings/ai', ...links.map(([url]) => url)]);

function Navigation({ user, space, pending, activePage, unsaved }) {
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const profile = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function dismissOutside(event) {
      if (!profile.current.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [menuOpen]);

  function closeProfile() {
    setMenuOpen(false);
    trigger.current.focus({ preventScroll: true });
  }

  async function logout() {
    if (unsaved.current && !window.confirm(t('Buang perubahan catatan yang belum disimpan?', 'Discard unsaved note changes?'))) return;
    setError('');
    try { await api('/logout', 'POST'); unsaved.current = false; location.replace('/login'); }
    catch (error) { setError(error.message); }
  }
  return <aside className="app-sidebar">
    <Brand space={space.id} />
    <nav className="nav-links" aria-label={t('Navigasi utama', 'Main navigation')}>
      {links.map(([url, idLabel, enLabel, Icon]) =>
        <a href={spaceHref(url, space.id)} key={url} aria-current={activePage === url ? 'page' : activePage === '/agenda' && url === '/dashboard' ? 'location' : undefined}>
          <Icon size={19} aria-hidden="true" /> <span>{t(idLabel, enLabel)}</span>
          {url === '/notifications' && pending > 0 && <span className="nav-count"><span className="sr-only">{t('Undangan baru ', 'New invitations ')}</span>{pending > 9 ? '9+' : pending}</span>}
        </a>)}
    </nav>
    {user.demo && <a className="demo-account-link" href="/register">{t('Buat akun', 'Create an account')} <ArrowUpRight size={15} /></a>}
    <div className="header-profile">
      {user.demo && <span className="demo-badge"><FlaskConical size={14} /> Demo</span>}
      <div className="profile-menu" ref={profile}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
        }}
        onKeyDown={(event) => {
          if (menuOpen && event.key === 'Escape') {
            event.preventDefault();
            closeProfile();
          }
        }}>
        <button type="button" className="profile-trigger" ref={trigger} aria-expanded={menuOpen} aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}>
          <Avatar name={user.name} src={avatarUrl(user)} /><span className="profile-copy"><strong>{user.name.split(' ')[0]}</strong><small>@{user.username}</small></span>
          <ChevronDown size={15} aria-hidden="true" />
          <span className="sr-only">{t('Menu akun', 'Account menu')}</span>
        </button>
        <div className="account-menu" id={menuId} inert={!menuOpen}>
          <a href={spaceHref('/settings', space.id)} onClick={closeProfile}><Settings2 size={16} aria-hidden="true" /> {t('Pengaturan', 'Settings')}</a>
          <button type="button" onClick={logout}><LogOut size={16} aria-hidden="true" /> {t('Keluar', 'Log out')}</button>
          <Feedback error={error} />
        </div>
      </div>
    </div>
  </aside>;
}

function WorkspaceApp() {
  useLanguage();
  const content = useRef(null);
  const view = useRef(null);
  const unsaved = useRef(false);
  const { user, setUser, data, route, error, refresh, switching, switchError, switchSpace, navigate } = useWorkspace(pathname, content, view, unsaved);
  const [newTeam, setNewTeam] = useState(false);
  const activePage = pageFor(route.pathname);

  function followLink(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || link.target) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.hash || !appPages.has(pageFor(url.pathname))) return;
    event.preventDefault();
    navigate(url);
  }

  if (!user || !data) return <main className="loading-page"><Brand />
    {error ? <><Feedback error={error} /><button className="button button-primary" onClick={() => location.reload()}>{t('Coba lagi', 'Try again')}</button></> : <p role="status">{t('Membuka Planer…', 'Opening Planer…')}</p>}
  </main>;

  const { workspace, spaces, notifications, initialMessages } = data;
  const { space, members } = workspace;
  const pending = notifications.filter(({ status }) => status === 'pending').length;
  const onCreate = () => setNewTeam(true);
  const teamPage = activePage === '/messages' || activePage === '/invite';
  return <div className="app-shell" onClick={followLink}>
    <a className="skip-link" href="#main-content">{t('Lewati ke konten', 'Skip to content')}</a>
    <Navigation user={user} space={space} pending={pending} activePage={activePage} unsaved={unsaved} />
    <div ref={view} id="main-content" className="workspace-content" tabIndex={-1}>
      {activePage !== '/notifications' && !activePage.startsWith('/settings') && <div className="space-bar-wrap">
        <SpacePicker spaces={spaces} current={space} switching={switching} onSwitch={switchSpace} onCreate={onCreate} />
        <Feedback error={switchError} />
      </div>}
      <div className="workspace-route" ref={content} inert={switching}>
        <React.Fragment key={`${activePage}:${space.id}:${route.searchParams.get('date') || ''}`}>
          {activePage === '/settings/ai' ? <AssistantSettings user={user} space={space} />
            : activePage === '/settings' ? <SettingsPage user={user} onProfile={setUser} space={space} />
            : activePage === '/notes' ? <NotesPage space={space} unsaved={unsaved} />
              : activePage === '/notifications' ? <Notifications items={notifications} refresh={refresh} error={switchError || error} />
            : teamPage && space.kind === 'personal' ? <main className="page inner-page"><ChooseTeam page={activePage} spaces={spaces} onCreate={onCreate} /></main>
              : activePage === '/messages' ? <Chat user={user} members={members} space={space} initialMessages={initialMessages} />
                : activePage === '/invite' ? <InvitePage user={user} members={members} space={space} />
                  : activePage === '/agenda' ? <AllAgenda workspace={workspace} error={error} />
                    : <Dashboard user={user} workspace={workspace} refresh={refresh} networkError={error} />}
        </React.Fragment>
      </div>
    </div>
    <PlanerAssistant key={space.id} workspace={workspace} refresh={refresh} />
    {newTeam && <NewTeamForm close={() => setNewTeam(false)} onCreated={(team) => {
      setNewTeam(false);
      navigate(new URL(spaceHref('/dashboard', team.id), location.origin));
    }} />}
  </div>;
}

createRoot(document.getElementById('root')).render(authModes[pathname] ? <AuthPage mode={authModes[pathname]} /> : <WorkspaceApp />);
