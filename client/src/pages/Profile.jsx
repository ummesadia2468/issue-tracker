import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useToast } from '../toast';
import { useTheme } from '../theme';
import { Avatar, ErrorNote, Field, Spinner } from '../components/ui';
import { ThemeToggle, LangSwitch } from '../components/Toolbar';

export default function Profile() {
  const { user, setUser } = useAuth(); const { t } = useI18n(); const toast = useToast(); useTheme();
  const [name, setName] = useState(user.name); const [dept, setDept] = useState(user.department || '');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', password: '' }); const [pwErr, setPwErr] = useState(''); const [pwBusy, setPwBusy] = useState(false);
  const file = useRef(null);
  const hasPassword = user.auth_provider === 'local';

  const save = async (photo) => {
    setErr(''); setBusy(true);
    const form = new FormData(); form.append('name', name); form.append('department', dept); if (photo) form.append('photo', photo);
    try { const d = await api('/auth/profile', { method: 'PATCH', form }); setUser(d.user); toast(t('Profile saved.')); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const changePw = async (e) => {
    e.preventDefault(); setPwErr(''); setPwBusy(true);
    try { await api('/auth/change-password', { method: 'POST', body: hasPassword ? pw : { password: pw.password } }); toast(t('Password updated.')); setPw({ current: '', password: '' }); } catch (x) { setPwErr(x.message); } finally { setPwBusy(false); }
  };

  return (
    <div className="mx-auto max-w-xl animate-rise space-y-6">
      <h1 className="text-3xl font-bold">{t('Profile')}</h1>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{t('Appearance and language')}</h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-medium">{t('Theme')}</p><p className="text-sm text-muted">{t('Light, dark, or follow your device.')}</p></div>
          <ThemeToggle />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <p className="text-sm font-medium">{t('Language')}</p><LangSwitch />
        </div>
      </section>

      <form className="card space-y-4 p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar user={user} size={20} />
            <button type="button" onClick={() => file.current?.click()} className="absolute -bottom-1 -end-1 rounded-full border border-line bg-surface p-1.5 shadow-sm" aria-label={t('Change photo')}><Camera className="h-4 w-4" /></button>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files[0] && save(e.target.files[0])} aria-label={t('Change photo')} />
          </div>
          <div><p className="font-semibold" dir="ltr">{user.email}</p><p className="text-sm text-muted">{t(user.role === 'admin' ? 'Admin' : user.role === 'technician' ? 'Technician' : 'Reporter')} &middot; {user.auth_provider === 'google' ? t('Google account') : t('Email account')}</p></div>
        </div>
        <ErrorNote>{err}</ErrorNote>
        <Field label={t('Full name')} htmlFor="n"><input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('Department or class')} htmlFor="d"><input id="d" className="input" value={dept} onChange={(e) => setDept(e.target.value)} /></Field>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('Save changes')}</button>
      </form>

      <form className="card space-y-4 p-5 sm:p-6" onSubmit={changePw}>
        <h2 className="text-xl font-semibold">{hasPassword ? t('Change password') : t('Set a password')}</h2>
        {!hasPassword && <p className="text-sm text-muted">{t('You signed up with Google. Setting a password also lets you sign in with your email.')}</p>}
        <ErrorNote>{pwErr}</ErrorNote>
        {hasPassword && <Field label={t('Current password')} htmlFor="c"><input id="c" type="password" autoComplete="current-password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} dir="ltr" /></Field>}
        <Field label={t('New password')} htmlFor="p" hint={t('At least 8 characters, with a letter and a number.')}><input id="p" type="password" autoComplete="new-password" className="input" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} dir="ltr" /></Field>
        <button className="btn-primary" disabled={pwBusy}>{pwBusy && <Spinner className="h-4 w-4" />}{t('Update password')}</button>
      </form>
    </div>
  );
}
