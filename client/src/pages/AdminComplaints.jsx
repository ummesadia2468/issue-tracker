import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, Users, Search, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { api, STATUS_LABEL, PRIORITY_LABEL } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useToast } from '../toast';
import { Empty, ErrorNote, PriorityTag, Spinner, StatusBadge } from '../components/ui';

const SORTS = [['created_at:desc', 'Newest first'], ['created_at:asc', 'Oldest first'], ['priority:desc', 'Highest priority'], ['support_count:desc', 'Most people affected'], ['updated_at:desc', 'Recently updated']];
const PAGE = 15;

function age(iso, t) {
  const m = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return t('{n} min ago', { n: Math.max(1, Math.round(m)) });
  if (m < 1440) return t('{n} h ago', { n: Math.round(m / 60) });
  return t('{n} d ago', { n: Math.round(m / 1440) });
}

export default function AdminComplaints() {
  const { user } = useAuth(); const { t } = useI18n(); const toast = useToast();
  const isAdmin = user.role === 'admin';
  const [f, setF] = useState({ search: '', status: '', priority: '', category_id: '', assigned_to: '', overdue: false, sort: 'created_at:desc' });
  const [q, setQ] = useState(''); // debounced search text
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]); const [techs, setTechs] = useState([]);
  const [sel, setSel] = useState([]); const [bulk, setBulk] = useState({ status: '', assigned_to: '' }); const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { api('/categories').then((d) => setCats(d.categories)).catch(() => {}); api('/admin/technicians').then((d) => setTechs(d.technicians)).catch(() => {}); }, []);
  useEffect(() => { const timer = setTimeout(() => { setQ(f.search); setPage(1); }, 350); return () => clearTimeout(timer); }, [f.search]);

  const load = useCallback(() => {
    const [sort, dir] = f.sort.split(':');
    const p = new URLSearchParams({ sort, dir, page, page_size: PAGE });
    if (q) p.set('search', q);
    ['status', 'priority', 'category_id', 'assigned_to'].forEach((k) => f[k] && p.set(k, f[k]));
    if (f.overdue) p.set('overdue', 'true');
    setLoading(true);
    api(`/admin/complaints?${p}`).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [f.sort, f.status, f.priority, f.category_id, f.assigned_to, f.overdue, q, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); setSel([]); }, [load]);

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setPage(1); };
  const rows = data?.complaints || [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const allOn = rows.length > 0 && sel.length === rows.length;
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const applyBulk = async () => {
    const body = { ids: sel };
    if (bulk.status) body.status = bulk.status;
    if (bulk.assigned_to !== '') body.assigned_to = bulk.assigned_to === 'none' ? null : Number(bulk.assigned_to);
    if (!body.status && body.assigned_to === undefined) return toast(t('Choose a status or a technician first.'), 'err');
    setBulkBusy(true);
    try { await api('/admin/complaints/bulk', { method: 'POST', body }); toast(t('{n} complaint(s) updated.', { n: sel.length })); setBulk({ status: '', assigned_to: '' }); load(); }
    catch (e) { toast(t(e.message), 'err'); } finally { setBulkBusy(false); }
  };

  return (
    <div className="animate-rise space-y-5">
      <div><h1 className="text-3xl font-bold">{isAdmin ? t('Complaints') : t('My assigned complaints')}</h1><p className="mt-1 text-muted">{data ? t('{n} found', { n: data.total }) : ' '}</p></div>

      <div className="card space-y-3 p-4">
        <div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input ps-10" placeholder={t('Search ticket, title, room or description')} value={f.search} onChange={set('search')} aria-label={t('Search complaints')} /></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <select className="input" value={f.status} onChange={set('status')} aria-label={t('Status')}><option value="">{t('Any status')}</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select>
          <select className="input" value={f.priority} onChange={set('priority')} aria-label={t('Priority')}><option value="">{t('Any priority')}</option>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select>
          <select className="input" value={f.category_id} onChange={set('category_id')} aria-label={t('Category')}><option value="">{t('Any category')}</option>{cats.map((c) => <option key={c.id} value={c.id}>{t(c.name)}</option>)}</select>
          {isAdmin && <select className="input" value={f.assigned_to} onChange={set('assigned_to')} aria-label={t('Assigned technician')}><option value="">{t('Any technician')}</option>{techs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
          <select className="input" value={f.sort} onChange={set('sort')} aria-label={t('Sort')}>{SORTS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.overdue} onChange={set('overdue')} className="h-4 w-4 accent-[rgb(var(--accent))]" />{t('Show only overdue')}</label>
      </div>

      {isAdmin && sel.length > 0 && (
        <div className="card sticky top-20 z-10 flex flex-wrap items-center gap-2 border-accent/50 p-3 shadow-pop">
          <span className="text-sm font-semibold">{t('{n} selected', { n: sel.length })}</span>
          <select className="input !w-auto" value={bulk.status} onChange={(e) => setBulk({ ...bulk, status: e.target.value })} aria-label={t('Set status')}><option value="">{t('Set status...')}</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select>
          <select className="input !w-auto" value={bulk.assigned_to} onChange={(e) => setBulk({ ...bulk, assigned_to: e.target.value })} aria-label={t('Assign to')}><option value="">{t('Assign to...')}</option><option value="none">{t('Unassign')}</option>{techs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <button className="btn-primary" onClick={applyBulk} disabled={bulkBusy}>{bulkBusy && <Spinner className="h-4 w-4" />}{t('Apply')}</button>
          <button className="btn-ghost ms-auto" onClick={() => setSel([])}>{t('Clear')}</button>
        </div>
      )}

      <ErrorNote>{err}</ErrorNote>

      {!data ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}</div>
        : rows.length === 0 ? <Empty title={t('No complaints match')}>{t('Try removing a filter or changing the search.')}</Empty> : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {isAdmin && <label className="flex items-center gap-2 px-1 text-sm text-muted"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? [] : rows.map((r) => r.id))} className="h-4 w-4 accent-[rgb(var(--accent))]" />{t('Select all on this page')}</label>}
          {rows.map((c) => (
            <div key={c.id} className={`card flex items-start gap-3 p-4 transition-colors ${sel.includes(c.id) ? 'border-accent bg-accent/5' : 'hover:border-accent/50'}`}>
              {isAdmin && <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggle(c.id)} className="mt-1.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]" aria-label={`${t('Select')} ${c.ticket_no}`} />}
              <Link to={`/complaints/${c.id}`} className="grid min-w-0 flex-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted"><span dir="ltr">{c.ticket_no}</span> &middot; {t(c.category)} &middot; {c.building}, {c.room}</p>
                  <h3 className="mt-0.5 truncate text-base font-semibold">{c.title}</h3>
                  <p className="mt-1 text-sm text-muted">{c.reporter_name === 'Anonymous' ? t('Anonymous') : c.reporter_name} &middot; {age(c.created_at, t)} &middot; {c.technician_name ? c.technician_name : <span className="text-[rgb(var(--pending-fg))]">{t('Unassigned')}</span>}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:justify-end">
                  {c.is_overdue && <span className="flex items-center gap-1 text-xs font-semibold text-danger"><AlertTriangle className="h-3.5 w-3.5" />{t('Overdue')}</span>}
                  {c.has_voice && <Mic className="h-4 w-4 text-muted" aria-label={t('Voice note')} />}
                  {c.support_count > 0 && <span className="flex items-center gap-1 text-xs text-muted"><Users className="h-3.5 w-3.5" />{c.support_count + 1}</span>}
                  <PriorityTag priority={c.priority} /><StatusBadge status={c.status} />
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button className="btn-ghost !p-2" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t('Previous page')}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
          <span className="text-sm text-muted">{t('Page {a} of {b}', { a: page, b: pages })}</span>
          <button className="btn-ghost !p-2" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={t('Next page')}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
        </div>
      )}
    </div>
  );
}
