import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Download } from 'lucide-react';
import { useAuth, homeFor } from '../auth';
import { useI18n } from '../i18n';
import { useInstallPrompt } from '../pwa';
import { Avatar } from './ui';
import { Toolbar } from './Toolbar';
import NotificationBell from './NotificationBell';

export const Logo = ({ className = 'h-8 w-8' }) => <img src="/icons/icon-192.png" alt="" className={`${className} rounded-[10px]`} />;

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { canInstall, install } = useInstallPrompt();
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  const isStaff = user.role !== 'reporter';
  const isAdmin = user.role === 'admin';

  const links = isStaff
    ? [['/admin', 'Overview', true], ['/admin/complaints', 'Complaints'], ...(isAdmin ? [['/admin/users', 'Users'], ['/admin/qr', 'Room QR codes']] : [])]
    : [['/dashboard', 'Dashboard', true], ['/report/new', 'Report an issue'], ['/complaints', 'My complaints']];

  const linkCls = ({ isActive }) => `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-accent/12 text-accent' : 'text-muted hover:bg-line/50 hover:text-ink'}`;
  const out = async () => { await logout(); nav('/'); };

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">{t('Skip to content')}</a>
      <header className="glass sticky top-0 z-20 border-b border-line/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to={homeFor(user)} className="flex items-center gap-2.5 font-display text-lg font-bold">
            <Logo /><span className="hidden sm:inline">{t('Issue Reporter')}</span>
          </Link>
          <nav className="ms-4 hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map(([to, label, end]) => <NavLink key={to} to={to} end={end} className={linkCls}>{t(label)}</NavLink>)}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <div className="hidden lg:block"><Toolbar /></div>
            <NotificationBell />
            <NavLink to="/profile" className="hidden items-center gap-2 rounded-full py-1 ps-1 pe-3 hover:bg-line/50 sm:flex" aria-label={t('Profile')}>
              <Avatar user={user} /><span className="max-w-[8rem] truncate text-sm font-medium">{user.name}</span>
            </NavLink>
            <button onClick={out} className="btn-ghost hidden !p-2 sm:inline-flex" aria-label={t('Sign out')} title={t('Sign out')}><LogOut className="h-5 w-5 rtl:-scale-x-100" /></button>
            <button onClick={() => setMenu(!menu)} className="btn-ghost !p-2 md:hidden" aria-label={t('Menu')} aria-expanded={menu}>{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {menu && (
          <nav className="animate-rise border-t border-line px-4 pb-4 pt-2 md:hidden" aria-label="Mobile">
            {[...links, ['/profile', 'Profile']].map(([to, label, end]) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMenu(false)} className={({ isActive }) => `block rounded-md px-3 py-3 text-base font-medium ${isActive ? 'bg-accent/10 text-accent' : ''}`}>{t(label)}</NavLink>
            ))}
            {canInstall && <button onClick={install} className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-start text-base font-medium text-accent"><Download className="h-4 w-4" />{t('Install app')}</button>}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line px-1 pt-3"><Toolbar /></div>
            <button onClick={out} className="mt-2 block w-full rounded-md px-3 py-3 text-start text-base font-medium text-danger">{t('Sign out')}</button>
          </nav>
        )}
      </header>
      {/* lg+ screens show the toolbar in the header; below that it lives in the menu */}
      <div className="mx-auto hidden max-w-6xl justify-end px-4 pt-3 md:flex lg:hidden"><Toolbar /></div>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8"><Outlet /></main>
      {canInstall && (
        <button onClick={install} className="btn-primary no-print fixed bottom-4 end-4 z-30 hidden shadow-pop md:inline-flex"><Download className="h-4 w-4" />{t('Install app')}</button>
      )}
    </div>
  );
}
