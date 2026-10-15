import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ImagePlus, X, Monitor, Projector, Fan, Lightbulb, Wifi, Wrench, TriangleAlert, QrCode, Users, Check } from 'lucide-react';
import { api, STATUS_LABEL, PRIORITY_LABEL } from '../api';
import { useI18n } from '../i18n';
import { useToast } from '../toast';
import { ErrorNote, Field, Spinner } from '../components/ui';
import VoiceRecorder from '../components/VoiceRecorder';

const ICONS = { monitor: Monitor, projector: Projector, fan: Fan, lightbulb: Lightbulb, wifi: Wifi, wrench: Wrench };
const MAX_FILES = 5, MAX_MB = 5, TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function NewComplaint() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams(); // QR codes open /report/new?building=..&room=..
  const [cats, setCats] = useState([]);
  const [f, setF] = useState({ category_id: '', building: params.get('building') || '', room: params.get('room') || '', priority: 'medium', title: '', description: '', anonymous: false });
  const [files, setFiles] = useState([]);
  const [voice, setVoice] = useState(null);
  const [dups, setDups] = useState([]);
  const [errs, setErrs] = useState({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const fromQr = params.get('building') && params.get('room');

  useEffect(() => { api('/categories').then((d) => setCats(d.categories)).catch(() => {}); }, []);

  const loadDups = () => {
    if (!f.category_id || !f.building.trim() || !f.room.trim()) { setDups([]); return () => {}; }
    const timer = setTimeout(() => {
      api(`/complaints/duplicates?${new URLSearchParams({ category_id: f.category_id, building: f.building.trim(), room: f.room.trim() })}`).then((d) => setDups(d.duplicates)).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  };
  useEffect(loadDups, [f.category_id, f.building, f.room]); // eslint-disable-line react-hooks/exhaustive-deps

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const addFiles = (list) => {
    const next = [...files]; let msg = '';
    for (const file of list) {
      if (!TYPES.includes(file.type)) msg = t('{name} is not a JPG, PNG or WebP image.', { name: file.name });
      else if (file.size > MAX_MB * 1024 * 1024) msg = t('{name} is larger than {n} MB.', { name: file.name, n: MAX_MB });
      else if (next.length >= MAX_FILES) msg = t('You can attach up to {n} photos.', { n: MAX_FILES });
      else next.push(file);
    }
    setFiles(next); setErr(msg); if (fileRef.current) fileRef.current.value = '';
  };

  const meToo = async (d) => {
    try {
      const r = await api(`/complaints/${d.id}/support`, { method: d.supported ? 'DELETE' : 'POST' });
      setDups((list) => list.map((x) => (x.id === d.id ? { ...x, supported: r.supported, affected: r.affected } : x)));
      if (r.supported) toast(t('Thanks. We added you to this report, so you will get its updates.'));
    } catch (x) { toast(t(x.message), 'err'); }
  };

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setErrs({}); setBusy(true);
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => form.append(k, v));
    files.forEach((file) => form.append('images', file));
    if (voice) form.append('voice', voice);
    try {
      const d = await api('/complaints', { method: 'POST', form });
      toast(t('Complaint submitted. We will keep you posted.'));
      nav(`/complaints/${d.id}`, { replace: true });
    } catch (x) { setErr(x.message); setErrs(x.fields || {}); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl animate-rise space-y-6" noValidate>
      <div><h1 className="text-3xl font-bold">{t('Report an issue')}</h1><p className="mt-1 text-muted">{t('The more detail you add, the faster it gets fixed.')}</p></div>
      {fromQr && <p className="flex items-center gap-2 rounded-md bg-accent/10 px-3 py-2 text-sm"><QrCode className="h-4 w-4" />{t('Location filled in from the room QR code.')}</p>}
      <ErrorNote>{err}</ErrorNote>

      <fieldset>
        <legend className="label">{t('What is the problem with?')}</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {cats.map((c) => { const Icon = ICONS[c.icon] || Wrench; const on = String(f.category_id) === String(c.id); return (
            <button type="button" key={c.id} onClick={() => setF({ ...f, category_id: c.id })} aria-pressed={on}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3.5 text-sm font-medium transition-all ${on ? 'border-accent bg-accent/10 text-accent shadow-sm' : 'border-line bg-surface hover:border-accent/50'}`}>
              <Icon className="h-6 w-6" />{t(c.name)}
            </button>); })}
        </div>
        {errs.category_id && <p className="mt-1 text-sm text-danger">{t(errs.category_id)}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('Building')} htmlFor="building" error={errs.building}><input id="building" className={`input ${errs.building ? 'input-error' : ''}`} placeholder={t('e.g. Block A')} value={f.building} onChange={set('building')} /></Field>
        <Field label={t('Room or lab')} htmlFor="room" error={errs.room}><input id="room" className={`input ${errs.room ? 'input-error' : ''}`} placeholder={t('e.g. Lab 3')} value={f.room} onChange={set('room')} /></Field>
      </div>

      {dups.length > 0 && (
        <div role="status" className="animate-rise rounded-lg border border-[rgb(var(--pending-fg))]/40 bg-[rgb(var(--pending-bg))] p-4 text-[rgb(var(--pending-fg))]">
          <p className="flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4" />{t('Someone may have already reported this')}</p>
          <ul className="mt-3 space-y-3">
            {dups.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface/70 p-3 text-ink">
                <div className="min-w-0">
                  <p className="font-medium">{d.title}</p>
                  <p className="flex items-center gap-2 text-xs text-muted"><span dir="ltr">{d.ticket_no}</span> &middot; {t(STATUS_LABEL[d.status])} &middot; <Users className="h-3 w-3" />{t('{n} people affected', { n: d.affected })}</p>
                </div>
                {d.mine ? <Link to={`/complaints/${d.id}`} className="btn-ghost !py-1.5 text-xs">{t('Your report')}</Link>
                  : <button type="button" onClick={() => meToo(d)} aria-pressed={d.supported} className={`btn !py-1.5 text-xs ${d.supported ? 'bg-accent text-accent-ink' : 'border border-line bg-surface'}`}>{d.supported ? <><Check className="h-3.5 w-3.5" />{t('Added')}</> : t('Me too, I have this problem')}</button>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">{t('If it is the same problem, tap "Me too" instead of filing again. If it is different, carry on.')}</p>
        </div>
      )}

      <Field label={t('Short title')} htmlFor="title" error={errs.title}><input id="title" maxLength={120} className={`input ${errs.title ? 'input-error' : ''}`} placeholder={t('e.g. Projector shows no signal')} value={f.title} onChange={set('title')} /></Field>
      <Field label={voice ? t('What is happening? (optional, you added a voice note)') : t('What is happening?')} htmlFor="desc" error={errs.description} hint={`${f.description.length}/2000`}><textarea id="desc" rows={5} maxLength={2000} className={`input ${errs.description ? 'input-error' : ''}`} placeholder={t('When did it start? What have you tried?')} value={f.description} onChange={set('description')} /></Field>

      <div>
        <span className="label">{t('Voice note (optional)')}</span>
        <VoiceRecorder onChange={setVoice} />
      </div>

      <Field label={t('How urgent is it?')} htmlFor="prio"><select id="prio" className="input" value={f.priority} onChange={set('priority')}>
        {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}{k === 'urgent' ? ` (${t('safety risk or blocks a class')})` : ''}</option>)}
      </select></Field>

      <div>
        <span className="label">{t('Photos (optional)')}</span>
        <div className="flex flex-wrap gap-3">
          {previews.map((p, i) => (
            <div key={p.url} className="relative h-24 w-24 overflow-hidden rounded-md border border-line">
              <img src={p.url} alt={`${t('Photo')} ${i + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute end-1 top-1 rounded-full bg-black/70 p-1 text-white" aria-label={`${t('Remove')} ${i + 1}`}><X className="h-3 w-3" /></button>
            </div>
          ))}
          {files.length < MAX_FILES && (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-sm text-muted transition-colors hover:border-accent hover:text-accent">
              <ImagePlus className="h-6 w-6" />{t('Add photo')}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => addFiles([...e.target.files])} aria-label={t('Add photo')} />
        <p className="mt-1.5 text-sm text-muted">{t('Up to {n} photos, {mb} MB each. JPG, PNG or WebP.', { n: MAX_FILES, mb: MAX_MB })}</p>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} />
        <span><span className="font-medium">{t('Report anonymously')}</span><span className="block text-sm text-muted">{t('Admins and technicians will not see your name. You can still track this complaint and get updates.')}</span></span>
      </label>

      <button className="btn-primary w-full !py-3 text-base" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('Submit complaint')}</button>
    </form>
  );
}
