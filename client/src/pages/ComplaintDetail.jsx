import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, X, Lock, Pencil, Trash2, Users, Mic } from 'lucide-react';
import { api, fmtDateTime, STATUS_LABEL, PRIORITY_LABEL } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useToast } from '../toast';
import { ErrorNote, PageLoader, PriorityTag, Spinner, StatusBadge, Field } from '../components/ui';

function Lightbox({ src, onClose }) {
  const { t } = useI18n();
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={t('Photo')} onClick={onClose}>
      <button className="absolute end-4 top-4 rounded-full bg-white/15 p-2 text-white" aria-label={t('Close')}><X className="h-5 w-5" /></button>
      <img src={src} alt="" className="max-h-full max-w-full rounded-md" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function Stars({ value, onPick }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={t('Rating')} dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}`} onClick={() => onPick?.(n)} disabled={!onPick} className="p-0.5">
          <Star className={`h-7 w-7 ${n <= value ? 'fill-[rgb(var(--pending-fg))] text-[rgb(var(--pending-fg))]' : 'text-line'}`} />
        </button>
      ))}
    </div>
  );
}

// Admin / technician controls: status, note, priority and assignment
function StaffPanel({ c, isAdmin, onDone }) {
  const { t } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState(c.status); const [note, setNote] = useState('');
  const [priority, setPriority] = useState(c.priority); const [tech, setTech] = useState(c.assigned_to ?? '');
  const [techs, setTechs] = useState([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (isAdmin) api('/admin/technicians').then((d) => setTechs(d.technicians)).catch(() => {}); }, [isAdmin]);
  useEffect(() => { setStatus(c.status); setPriority(c.priority); setTech(c.assigned_to ?? ''); }, [c.status, c.priority, c.assigned_to]);

  const dirty = status !== c.status || priority !== c.priority || String(tech) !== String(c.assigned_to ?? '') || note.trim();
  const save = async () => {
    setBusy(true); setErr('');
    const body = { note: note.trim() || undefined };
    if (status !== c.status) body.status = status;
    if (isAdmin && priority !== c.priority) body.priority = priority;
    if (isAdmin && String(tech) !== String(c.assigned_to ?? '')) body.assigned_to = tech === '' ? null : Number(tech);
    try { await api(`/admin/complaints/${c.id}`, { method: 'PATCH', body }); setNote(''); toast(t('Complaint updated.')); await onDone(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <section className="card border-accent/40 p-5 sm:p-6">
      <h2 className="text-xl font-semibold">{t('Manage this complaint')}</h2>
      <ErrorNote>{err}</ErrorNote>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label={t('Status')} htmlFor="st"><select id="st" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></Field>
        {isAdmin && <Field label={t('Priority')} htmlFor="pr"><select id="pr" className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></Field>}
        {isAdmin && <Field label={t('Assigned technician')} htmlFor="te"><select id="te" className="input" value={tech} onChange={(e) => setTech(e.target.value)}><option value="">{t('Not assigned')}</option>{techs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
      </div>
      <div className="mt-4"><Field label={t('Note for the reporter (optional)')} htmlFor="nt"><input id="nt" className="input" maxLength={500} placeholder={t('e.g. Replaced the HDMI cable')} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
      <button className="btn-primary mt-4" disabled={busy || !dirty} onClick={save}>{busy && <Spinner className="h-4 w-4" />}{t('Save changes')}</button>
    </section>
  );
}

export default function ComplaintDetail() {
  const { id } = useParams(); const { user } = useAuth(); const { t } = useI18n(); const toast = useToast(); const nav = useNavigate();
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(null);
  const [msg, setMsg] = useState(''); const [internal, setInternal] = useState(false); const [busy, setBusy] = useState('');
  const [reason, setReason] = useState(''); const [showReopen, setShowReopen] = useState(false);
  const [rating, setRating] = useState(0); const [rateNote, setRateNote] = useState('');
  const [actErr, setActErr] = useState('');
  const [editing, setEditing] = useState(false); const [ed, setEd] = useState({ title: '', description: '', priority: 'medium' });
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(() => api(`/complaints/${id}`).then(setD).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (key, fn) => { setBusy(key); setActErr(''); try { await fn(); await load(); } catch (e) { setActErr(e.message); } finally { setBusy(''); } };

  if (err) return <div className="space-y-4"><ErrorNote>{err}</ErrorNote><Link to="/" className="text-accent hover:underline">{t('Go back')}</Link></div>;
  if (!d) return <PageLoader />;
  const c = d.complaint;
  const isOwner = user.role === 'reporter' && c.user_id === user.id;
  const isStaff = user.role !== 'reporter';
  const back = isStaff ? '/admin/complaints' : '/complaints';
  const canEdit = isOwner && c.status === 'pending';

  const startEdit = () => { setEd({ title: c.title, description: c.has_voice && c.description.startsWith('(Voice note') ? '' : c.description, priority: c.priority }); setEditing(true); };

  return (
    <div className="mx-auto max-w-3xl animate-rise space-y-6">
      <Link to={back} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('Back to complaints')}</Link>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-muted"><span dir="ltr">{c.ticket_no}</span> &middot; {t(c.category)}</span><StatusBadge status={c.status} />
        </div>

        {!editing ? (<>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{c.title}</h1>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div><dt className="text-muted">{t('Location')}</dt><dd className="font-medium">{c.building}, {c.room}</dd></div>
            <div><dt className="text-muted">{t('Priority')}</dt><dd><PriorityTag priority={c.priority} /></dd></div>
            <div><dt className="text-muted">{t('Reported')}</dt><dd className="font-medium">{fmtDateTime(c.created_at)}</dd></div>
            <div><dt className="text-muted">{t('Assigned to')}</dt><dd className="font-medium">{c.technician_name || t('Not assigned yet')}</dd></div>
            {isStaff && <div><dt className="text-muted">{t('Reporter')}</dt><dd className="font-medium">{c.reporter_name === 'Anonymous' ? t('Anonymous') : c.reporter_name}</dd></div>}
            {c.affected > 1 && <div><dt className="text-muted">{t('People affected')}</dt><dd className="flex items-center gap-1 font-medium"><Users className="h-4 w-4 text-accent" />{c.affected}</dd></div>}
          </dl>
          {c.is_overdue && <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{t('This is past its {h}-hour target for {p} priority issues.', { h: c.sla_hours, p: t(PRIORITY_LABEL[c.priority]).toLowerCase() })}</p>}
          <p className="mt-5 whitespace-pre-wrap leading-relaxed">{c.has_voice && c.description.startsWith('(Voice note') ? <span className="text-muted">{t('The reporter left a voice note instead of a written description.')}</span> : c.description}</p>
          {d.voice && (
            <div className="mt-5 rounded-lg border border-line bg-bg p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Mic className="h-4 w-4 text-accent" />{t('Voice note')}</p>
              <audio controls preload="none" src={d.voice.url} className="w-full" />
            </div>
          )}
          {d.images.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-3">
              {d.images.map((im, i) => (
                <button key={im.id} onClick={() => setZoom(im.url)} className="h-24 w-24 overflow-hidden rounded-md border border-line transition-transform hover:scale-[1.03]" aria-label={`${t('Photo')} ${i + 1}`}>
                  <img src={im.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="mt-6 border-t border-line pt-4">
              {!confirmDel ? (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost" onClick={startEdit}><Pencil className="h-4 w-4" />{t('Edit')}</button>
                  <button className="btn-ghost text-danger" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4" />{t('Withdraw complaint')}</button>
                </div>
              ) : (
                <div className="space-y-3 rounded-md bg-danger/10 p-4">
                  <p className="text-sm font-medium">{t('Withdraw this complaint? It will be deleted and cannot be restored.')}</p>
                  <div className="flex gap-2">
                    <button className="btn-danger" disabled={busy === 'del'} onClick={() => act('del', async () => { await api(`/complaints/${id}`, { method: 'DELETE' }); toast(t('Complaint withdrawn.')); nav('/complaints', { replace: true }); })}>{busy === 'del' && <Spinner className="h-4 w-4" />}{t('Yes, withdraw it')}</button>
                    <button className="btn-ghost" onClick={() => setConfirmDel(false)}>{t('Keep it')}</button>
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs text-muted">{t('You can edit or withdraw this until someone starts working on it.')}</p>
            </div>
          )}
        </>) : (
          <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); act('edit', async () => { await api(`/complaints/${id}`, { method: 'PATCH', body: { title: ed.title, ...(ed.description ? { description: ed.description } : {}), priority: ed.priority } }); setEditing(false); toast(t('Changes saved.')); }); }}>
            <Field label={t('Short title')} htmlFor="et"><input id="et" className="input" maxLength={120} value={ed.title} onChange={(e) => setEd({ ...ed, title: e.target.value })} /></Field>
            <Field label={t('What is happening?')} htmlFor="ed"><textarea id="ed" rows={5} className="input" maxLength={2000} value={ed.description} onChange={(e) => setEd({ ...ed, description: e.target.value })} /></Field>
            <Field label={t('How urgent is it?')} htmlFor="ep"><select id="ep" className="input" value={ed.priority} onChange={(e) => setEd({ ...ed, priority: e.target.value })}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></Field>
            <div className="flex gap-2"><button className="btn-primary" disabled={busy === 'edit'}>{busy === 'edit' && <Spinner className="h-4 w-4" />}{t('Save changes')}</button><button type="button" className="btn-ghost" onClick={() => setEditing(false)}>{t('Cancel')}</button></div>
          </form>
        )}
      </div>

      <ErrorNote>{actErr}</ErrorNote>

      {isStaff && <StaffPanel c={c} isAdmin={user.role === 'admin'} onDone={load} />}

      {isOwner && c.status === 'resolved' && (
        <div className="card space-y-4 p-5">
          {c.rating ? (<div><h2 className="font-semibold">{t('Your rating')}</h2><Stars value={c.rating} />{c.rating_comment && <p className="mt-1 text-sm text-muted">{c.rating_comment}</p>}</div>) : (
            <div><h2 className="font-semibold">{t('Was it fixed properly?')}</h2><div className="mt-2"><Stars value={rating} onPick={setRating} /></div>
              {rating > 0 && <div className="mt-3 space-y-3"><input className="input" placeholder={t('Anything to add? (optional)')} value={rateNote} onChange={(e) => setRateNote(e.target.value)} maxLength={500} />
                <button className="btn-primary" disabled={busy === 'rate'} onClick={() => act('rate', async () => { await api(`/complaints/${id}/rate`, { method: 'POST', body: { rating, comment: rateNote || undefined } }); toast(t('Thanks for your feedback.')); })}>{busy === 'rate' && <Spinner className="h-4 w-4" />}{t('Send rating')}</button></div>}
            </div>)}
          <div className="border-t border-line pt-4">
            {!showReopen ? <button className="btn-ghost" onClick={() => setShowReopen(true)}>{t('The problem is back')}</button> : (
              <div className="space-y-3"><textarea className="input" rows={3} placeholder={t('What is still wrong?')} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2"><button className="btn-primary" disabled={busy === 'reopen'} onClick={() => act('reopen', async () => { await api(`/complaints/${id}/reopen`, { method: 'POST', body: { reason } }); setShowReopen(false); setReason(''); })}>{busy === 'reopen' && <Spinner className="h-4 w-4" />}{t('Reopen complaint')}</button><button className="btn-ghost" onClick={() => setShowReopen(false)}>{t('Cancel')}</button></div></div>)}
          </div>
        </div>
      )}

      <section className="card p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{t('Progress')}</h2>
        <ol className="mt-4 space-y-4 border-s-2 border-line ps-5">
          {d.history.map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -start-[27px] top-1.5 h-3 w-3 rounded-full bg-accent ring-4 ring-surface" />
              <p className="font-medium">{h.old_status ? `${t(STATUS_LABEL[h.old_status])} → ${t(STATUS_LABEL[h.new_status])}` : t(STATUS_LABEL[h.new_status])}</p>
              {h.note && <p className="text-sm">{h.note}</p>}
              <p className="text-sm text-muted">{fmtDateTime(h.created_at)}{h.changed_by ? ` · ${h.changed_by === 'Anonymous' ? t('Anonymous') : h.changed_by}` : ''}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{t('Conversation')}</h2>
        <ul className="mt-4 space-y-4">
          {d.comments.length === 0 && <li className="text-sm text-muted">{t('No messages yet.')}</li>}
          {d.comments.map((m) => (
            <li key={m.id} className={`rounded-md p-3 ${m.internal ? 'border border-dashed border-line bg-line/20' : 'bg-bg'}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">{m.author === 'Anonymous' ? t('Anonymous') : m.author}</span>{m.author_role !== 'reporter' && <span className="text-xs text-accent">{t('Staff')}</span>}{m.internal && <span className="flex items-center gap-1 text-xs text-muted"><Lock className="h-3 w-3" />{t('Internal note')}</span>}<span className="text-muted">{fmtDateTime(m.created_at)}</span></div>
              <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
            </li>
          ))}
        </ul>
        <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!msg.trim()) return; act('msg', async () => { await api(`/complaints/${id}/comments`, { method: 'POST', body: { message: msg, internal: isStaff && internal } }); setMsg(''); setInternal(false); }); }}>
          <textarea className="input" rows={3} placeholder={isStaff ? t('Reply to the reporter or leave an internal note') : t('Add more detail or ask a question')} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} aria-label={t('Message')} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {isStaff ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />{t('Internal note (reporter cannot see it)')}</label> : <span />}
            <button className="btn-primary" disabled={busy === 'msg' || !msg.trim()}>{busy === 'msg' && <Spinner className="h-4 w-4" />}{t('Send')}</button>
          </div>
        </form>
      </section>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
