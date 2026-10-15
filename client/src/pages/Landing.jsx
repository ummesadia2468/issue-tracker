import { Link } from 'react-router-dom';
import { Monitor, Projector, Fan, Lightbulb, Wifi, Check, Mic, BellRing, Languages, ShieldCheck } from 'lucide-react';
import { useAuth, homeFor } from '../auth';
import { useI18n } from '../i18n';
import { Toolbar } from '../components/Toolbar';
import { Logo } from '../components/Layout';

const CATS = [[Monitor, 'Computers'], [Projector, 'Projectors'], [Fan, 'Fans'], [Lightbulb, 'Lights'], [Wifi, 'Wi-Fi']];

// The hero shows what the product actually produces: a work-order ticket with its history.
function Ticket() {
  const { t } = useI18n();
  const steps = [['Reported', '9:12', true], ['Assigned to Sara, IT', '9:40', true], ['In progress', '10:05', true], ['Resolved', t('Waiting'), false]];
  return (
    <div className="card w-full max-w-sm animate-rise p-6 shadow-pop [animation-delay:150ms] md:rotate-1">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-semibold text-muted" dir="ltr">TKT-00124</span>
        <span className="badge badge-in_progress"><span className="h-1.5 w-1.5 rounded-full bg-current" />{t('In progress')}</span>
      </div>
      <h3 className="mt-3 text-xl font-bold leading-snug">{t('Projector shows no signal')}</h3>
      <p className="mt-1 text-sm text-muted">{t('Block A, Lab 3')}</p>
      <ol className="mt-5 space-y-3.5 border-s-2 border-line ps-5">
        {steps.map(([label, when, done]) => (
          <li key={label} className="relative text-sm">
            <span className={`absolute -start-[29px] top-0.5 grid h-4 w-4 place-items-center rounded-full ${done ? 'bg-accent text-accent-ink' : 'border-2 border-line bg-surface'}`}>{done && <Check className="h-3 w-3" />}</span>
            <span className={done ? 'font-medium' : 'text-muted'}>{t(label)}</span><span className="ms-2 text-muted">{when}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { t } = useI18n();
  const feats = [[Mic, 'Voice notes', 'Just say what is wrong. No typing needed.'], [BellRing, 'Instant alerts', 'Know the moment your issue is picked up or fixed.'], [Languages, 'اردو and English', 'Use the whole app in the language you prefer.'], [ShieldCheck, 'Anonymous option', 'Report sensitive problems without your name showing.']];
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <span className="flex items-center gap-2.5 font-display text-lg font-bold"><Logo />{t('Issue Reporter')}</span>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><Toolbar /></div>
          {user ? <Link to={homeFor(user)} className="btn-primary">{t('Open dashboard')}</Link> : <>
            <Link to="/login" className="btn-ghost">{t('Sign in')}</Link>
            <Link to="/register" className="btn-primary hidden sm:inline-flex">{t('Create account')}</Link>
          </>}
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl justify-end px-4 sm:hidden"><Toolbar /></div>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-2 md:py-24">
        <div className="animate-rise">
          <h1 className="text-4xl font-bold leading-[1.1] sm:text-5xl">{t('Broken projector? Tell us once, then watch it get fixed.')}</h1>
          <p className="mt-5 max-w-lg text-lg text-muted">{t('Report problems with computers, projectors, fans, lights and Wi-Fi in under a minute. Add photos or a voice note, and follow every step until it is resolved.')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={user ? '/report/new' : '/register'} className="btn-primary !px-6 !py-3 text-base">{t('Report an issue')}</Link>
            {!user && <Link to="/login" className="btn-ghost !px-6 !py-3 text-base">{t('Sign in')}</Link>}
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
            {CATS.map(([Icon, label]) => <li key={label} className="flex items-center gap-2"><Icon className="h-4 w-4 text-accent" />{t(label)}</li>)}
          </ul>
        </div>
        <div className="flex justify-center md:justify-end"><Ticket /></div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {feats.map(([Icon, title, text], i) => (
            <div key={title} className="card animate-rise p-5" style={{ animationDelay: `${250 + i * 70}ms` }}>
              <span className="grid h-10 w-10 place-items-center rounded-md bg-accent/12 text-accent"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-lg font-semibold">{t(title)}</h3>
              <p className="mt-1 text-sm text-muted">{t(text)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
