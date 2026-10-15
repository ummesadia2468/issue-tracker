import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import { useAuth, homeFor } from '../auth';
import { useI18n } from '../i18n';
import { ErrorNote, Field, Spinner } from '../components/ui';
import { Logo } from '../components/Layout';
import { Toolbar } from '../components/Toolbar';
import GoogleButton from '../components/GoogleButton';

function Shell({ title, subtitle, children, footer }) {
  const { t } = useI18n();
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-16">
      <div className="absolute end-4 top-4"><Toolbar /></div>
      <div className="w-full max-w-md animate-rise">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5 font-display text-xl font-bold">
          <Logo className="h-10 w-10" />{t('Issue Reporter')}
        </Link>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold">{t(title)}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{t(subtitle)}</p>}
          <div className="mt-6 space-y-4">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}

const Divider = () => {
  const { t } = useI18n();
  return <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted"><span className="h-px flex-1 bg-line" />{t('or')}<span className="h-px flex-1 bg-line" /></div>;
};

function PasswordInput({ id, value, onChange, autoComplete, error }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} className={`input pe-11 ${error ? 'input-error' : ''}`} value={value} onChange={onChange} dir="ltr" />
      <button type="button" onClick={() => setShow(!show)} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink" aria-label={show ? t('Hide password') : t('Show password')}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function useAuthConfig() {
  const [cfg, setCfg] = useState({ googleClientId: null, allowedDomains: [] });
  useEffect(() => { api('/auth/config').then(setCfg).catch(() => {}); }, []);
  return cfg;
}

const DomainHint = ({ domains }) => {
  const { t } = useI18n();
  return domains?.length ? <p className="rounded-md bg-accent/10 px-3 py-2 text-sm">{t('Only {domains} email addresses can register.', { domains: domains.map((d) => '@' + d).join(', ') })}</p> : null;
};

export function Login() {
  const { user, login, google } = useAuth();
  const { t } = useI18n();
  const cfg = useAuthConfig();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '', remember: true });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={loc.state?.from || homeFor(user)} replace />;

  const go = (u) => nav(u.role === 'reporter' ? loc.state?.from || homeFor(u) : homeFor(u), { replace: true });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { go(await login(f.email, f.password, f.remember)); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Sign in" subtitle="Welcome back." footer={<>{t('New here?')} <Link to="/register" className="font-medium text-accent hover:underline">{t('Create an account')}</Link></>}>
      <GoogleButton clientId={cfg.googleClientId} onCredential={async (c) => { try { go(await google(c)); } catch (x) { setErr(x.message); } }} />
      <Divider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorNote>{err}</ErrorNote>
        <Field label={t('Email')} htmlFor="email"><input id="email" type="email" autoComplete="email" required className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} dir="ltr" /></Field>
        <Field label={t('Password')} htmlFor="pw"><PasswordInput id="pw" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--accent))]" />{t('Keep me signed in')}</label>
          <Link to="/forgot-password" className="text-accent hover:underline">{t('Forgot password?')}</Link>
        </div>
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('Sign in')}</button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { user, register, google } = useAuth();
  const { t } = useI18n();
  const cfg = useAuthConfig();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', department: '', password: '' });
  const [errs, setErrs] = useState({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState('');
  if (user) return <Navigate to={homeFor(user)} replace />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setErrs({}); setBusy(true);
    try {
      const d = await register(f);
      if (d.needsVerification) setSent(d.message); else nav('/dashboard', { replace: true });
    } catch (x) { setErr(x.message); setErrs(x.fields || {}); } finally { setBusy(false); }
  };
  if (sent) return <Shell title="Check your email" footer={<Link to="/login" className="font-medium text-accent hover:underline">{t('Back to sign in')}</Link>}><p className="text-sm">{t(sent)} {t('We sent the link to')} <b dir="ltr">{f.email}</b>.</p></Shell>;

  return (
    <Shell title="Create your account" subtitle="Reporting an issue takes a minute." footer={<>{t('Already registered?')} <Link to="/login" className="font-medium text-accent hover:underline">{t('Sign in')}</Link></>}>
      <GoogleButton text="signup_with" label="Sign up with Google" clientId={cfg.googleClientId} onCredential={async (c) => { try { const u = await google(c); nav(homeFor(u), { replace: true }); } catch (x) { setErr(x.message); } }} />
      <Divider />
      <DomainHint domains={cfg.allowedDomains} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorNote>{err && !Object.keys(errs).length ? err : ''}</ErrorNote>
        <Field label={t('Full name')} htmlFor="name" error={errs.name}><input id="name" autoComplete="name" className={`input ${errs.name ? 'input-error' : ''}`} value={f.name} onChange={set('name')} /></Field>
        <Field label={t('Email')} htmlFor="email" error={errs.email}><input id="email" type="email" autoComplete="email" className={`input ${errs.email ? 'input-error' : ''}`} value={f.email} onChange={set('email')} dir="ltr" /></Field>
        <Field label={t('Department or class (optional)')} htmlFor="dept"><input id="dept" className="input" value={f.department} onChange={set('department')} /></Field>
        <Field label={t('Password')} htmlFor="pw" error={errs.password} hint={t('At least 8 characters, with a letter and a number.')}><PasswordInput id="pw" autoComplete="new-password" error={errs.password} value={f.password} onChange={set('password')} /></Field>
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('Create account')}</button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { setMsg((await api('/auth/forgot-password', { method: 'POST', body: { email } })).message); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Reset your password" subtitle="Enter your email and we will send a reset link." footer={<Link to="/login" className="font-medium text-accent hover:underline">{t('Back to sign in')}</Link>}>
      {msg ? <p className="rounded-md bg-accent/10 p-3 text-sm">{t(msg)}</p> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <ErrorNote>{err}</ErrorNote>
          <Field label={t('Email')} htmlFor="email"><input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></Field>
          <button className="btn-primary w-full !py-3" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('Send reset link')}</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const { t } = useI18n();
  const [params] = useSearchParams(); const nav = useNavigate();
  const [password, setPassword] = useState(''); const [err, setErr] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/auth/reset-password', { method: 'POST', body: { token: params.get('token') || '', password } }); setDone(true); setTimeout(() => nav('/login'), 1800); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Choose a new password" footer={<Link to="/login" className="font-medium text-accent hover:underline">{t('Back to sign in')}</Link>}>
      {done ? <p className="rounded-md bg-accent/10 p-3 text-sm">{t('Password updated. Taking you to sign in.')}</p> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <ErrorNote>{err}</ErrorNote>
          <Field label={t('New password')} htmlFor="pw" hint={t('At least 8 characters, with a letter and a number.')}><PasswordInput id="pw" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <button className="btn-primary w-full !py-3" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('Save new password')}</button>
        </form>
      )}
    </Shell>
  );
}

export function VerifyEmail() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [state, setState] = useState({ loading: true, msg: '', ok: false });
  useEffect(() => {
    api(`/auth/verify-email?token=${encodeURIComponent(params.get('token') || '')}`)
      .then((d) => setState({ loading: false, ok: true, msg: d.message }))
      .catch((e) => setState({ loading: false, ok: false, msg: e.message }));
  }, [params]);
  return (
    <Shell title="Email verification" footer={<Link to="/login" className="font-medium text-accent hover:underline">{t('Go to sign in')}</Link>}>
      {state.loading ? <Spinner className="mx-auto h-5 w-5" /> : state.ok ? <p className="rounded-md bg-accent/10 p-3 text-sm">{t(state.msg)}</p> : <ErrorNote>{state.msg}</ErrorNote>}
    </Shell>
  );
}
