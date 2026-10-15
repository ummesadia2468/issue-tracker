import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Clock, Star, AlertTriangle, MapPin } from 'lucide-react';
import { api, fmtHours } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { Empty, ErrorNote, PageLoader, StatusBadge, PriorityTag } from '../components/ui';
import { ComplaintRow } from './Dashboard';

const RANGES = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'All time']];
const isoDaysAgo = (n) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

// SVG charts need real color values, so read the current theme's CSS variables
function useChartColors() {
  const { resolved } = useTheme();
  return useMemo(() => {
    const v = (n) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim().split(/\s+/).join(',')})`;
    return { accent: v('accent'), muted: v('muted'), line: v('line'), surface: v('surface'), ink: v('ink'), pending: v('pending-fg'), progress: v('progress-fg'), resolved: v('resolved-fg'), danger: v('danger') };
  }, [resolved]);
}

function Kpi({ label, value, tone, icon: Icon, sub }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-sm text-muted"><span>{label}</span>{Icon && <Icon className="h-4 w-4" />}</div>
      <div className={`mt-1 font-display text-3xl font-bold ${tone || ''}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

const Panel = ({ title, children, className = '' }) => (
  <section className={`card p-5 ${className}`}><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>
);

function TechnicianHome() {
  const { t } = useI18n();
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api('/admin/complaints?page_size=100&sort=priority').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!d) return <PageLoader />;
  const open = d.complaints.filter((c) => c.status !== 'resolved');
  return (
    <div className="animate-rise space-y-6">
      <div><h1 className="text-3xl font-bold">{t('My work')}</h1><p className="mt-1 text-muted">{t('{n} open job(s) assigned to you, most urgent first.', { n: open.length })}</p></div>
      {open.length === 0 ? <Empty title={t('All clear')}>{t('Nothing is assigned to you right now.')}</Empty>
        : <div className="grid gap-3 md:grid-cols-2">{open.map((c) => <ComplaintRow key={c.id} c={c} />)}</div>}
    </div>
  );
}

export default function AdminOverview() {
  const { user } = useAuth();
  if (user.role === 'technician') return <TechnicianHome />;
  return <AdminHome />;
}

function AdminHome() {
  const { t } = useI18n();
  const col = useChartColors();
  const [range, setRange] = useState('30');
  const [s, setS] = useState(null); const [att, setAtt] = useState([]); const [err, setErr] = useState('');
  const qs = range === 'all' ? '' : `from=${isoDaysAgo(Number(range))}`;

  useEffect(() => {
    setS(null);
    api(`/stats?${qs}`).then(setS).catch((e) => setErr(e.message));
  }, [qs]);
  useEffect(() => { api('/admin/complaints?overdue=true&page_size=5&sort=priority').then((d) => setAtt(d.complaints)).catch(() => {}); }, []);

  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!s) return <PageLoader />;
  const tt = { background: col.surface, border: `1px solid ${col.line}`, borderRadius: 10, color: col.ink, fontSize: 13 };
  const PIE = [col.accent, col.progress, col.pending, col.resolved, col.danger, col.muted];
  const statusData = [{ name: t('Pending'), n: s.totals.pending, fill: col.pending }, { name: t('In progress'), n: s.totals.in_progress, fill: col.progress }, { name: t('Resolved'), n: s.totals.resolved, fill: col.resolved }];

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">{t('Overview')}</h1><p className="mt-1 text-muted">{t('How issues are being reported and resolved.')}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input !w-auto" value={range} onChange={(e) => setRange(e.target.value)} aria-label={t('Time range')}>{RANGES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>
          <a className="btn-ghost" href={`/api/stats/export.csv?${qs}`}><Download className="h-4 w-4" />CSV</a>
          <a className="btn-ghost" href={`/api/stats/export.pdf?${qs}`}><Download className="h-4 w-4" />PDF</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={t('Total')} value={s.totals.total} />
        <Kpi label={t('Pending')} value={s.totals.pending} tone="text-[rgb(var(--pending-fg))]" />
        <Kpi label={t('In progress')} value={s.totals.in_progress} tone="text-[rgb(var(--progress-fg))]" />
        <Kpi label={t('Resolved')} value={s.totals.resolved} tone="text-[rgb(var(--resolved-fg))]" />
        <Kpi label={t('Overdue')} value={s.totals.overdue} tone={s.totals.overdue ? 'text-danger' : ''} icon={AlertTriangle} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi label={t('Average resolution time')} value={fmtHours(s.avg_resolution_hours)} icon={Clock} />
        <Kpi label={t('Average rating')} value={s.avg_rating ?? '-'} icon={Star} sub={s.ratings_count ? t('{n} rating(s)', { n: s.ratings_count }) : t('No ratings yet')} />
      </div>

      {s.totals.total === 0 ? <Empty title={t('No complaints in this period')}>{t('Charts will appear as soon as issues are reported.')}</Empty> : (<>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title={t('Complaints over time')} className="lg:col-span-2">
            <div className="h-64" dir="ltr">
              <ResponsiveContainer>
                <AreaChart data={s.over_time} margin={{ left: -20, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col.accent} stopOpacity={0.35} /><stop offset="100%" stopColor={col.accent} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke={col.line} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: col.muted, fontSize: 12 }} tickFormatter={(d) => d.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: col.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tt} />
                  <Area type="monotone" dataKey="reported" name={t('Reported')} stroke={col.accent} strokeWidth={2.5} fill="url(#g1)" />
                  <Area type="monotone" dataKey="resolved" name={t('Resolved')} stroke={col.resolved} strokeWidth={2} fill="none" strokeDasharray="5 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title={t('By category')}>
            <div className="h-44" dir="ltr">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={s.by_category} dataKey="n" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none">
                    {s.by_category.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tt} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {s.by_category.map((c, i) => <li key={c.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE[i % PIE.length] }} />{t(c.name)}</span><span className="font-medium">{c.n}</span></li>)}
            </ul>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title={t('Status distribution')}>
            <div className="h-48" dir="ltr">
              <ResponsiveContainer>
                <BarChart data={statusData} margin={{ left: -24, right: 4 }}>
                  <CartesianGrid stroke={col.line} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: col.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: col.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tt} cursor={{ fill: col.line, opacity: 0.4 }} />
                  <Bar dataKey="n" name={t('Complaints')} radius={[6, 6, 0, 0]}>{statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title={t('Problem hotspots')} className="lg:col-span-2">
            {s.hotspots.length === 0 ? <p className="text-sm text-muted">{t('No data yet.')}</p> : (
              <ul className="space-y-2.5">
                {s.hotspots.slice(0, 6).map((h) => (
                  <li key={`${h.building}-${h.room}`} className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 shrink-0 text-muted" />
                    <span className="w-40 shrink-0 truncate font-medium">{h.building}, {h.room}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-accent" style={{ width: `${(h.n / s.hotspots[0].n) * 100}%` }} /></span>
                    <span className="w-6 text-end font-semibold">{h.n}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </>)}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('Needs attention (overdue)')}>
          {att.length === 0 ? <p className="text-sm text-muted">{t('Nothing is overdue. Nice work.')}</p> : (
            <ul className="divide-y divide-line">
              {att.map((c) => (
                <li key={c.id}><Link to={`/complaints/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-accent">
                  <span className="min-w-0"><span className="block truncate font-medium">{c.title}</span><span className="text-xs text-muted">{c.building}, {c.room}</span></span>
                  <span className="flex items-center gap-3"><PriorityTag priority={c.priority} /><StatusBadge status={c.status} /></span>
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t('Technician performance')}>
          {s.technicians.length === 0 ? <p className="text-sm text-muted">{t('No technicians yet. Add them from the Users page.')}</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-start text-muted"><tr><th className="pb-2 text-start font-medium">{t('Name')}</th><th className="pb-2 text-end font-medium">{t('Assigned')}</th><th className="pb-2 text-end font-medium">{t('Resolved')}</th><th className="pb-2 text-end font-medium">{t('Avg time')}</th></tr></thead>
              <tbody className="divide-y divide-line">{s.technicians.map((x) => <tr key={x.id}><td className="py-2.5 font-medium">{x.name}</td><td className="py-2.5 text-end">{x.assigned}</td><td className="py-2.5 text-end">{x.resolved}</td><td className="py-2.5 text-end">{fmtHours(x.avg_hours)}</td></tr>)}</tbody>
            </table></div>
          )}
        </Panel>
      </div>
    </div>
  );
}
