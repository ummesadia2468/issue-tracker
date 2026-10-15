import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Mic, Users, Image as ImageIcon } from 'lucide-react';
import { api, fmtDate } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Empty, ErrorNote, PageLoader, PriorityTag, StatusBadge } from '../components/ui';

export function ComplaintRow({ c }) {
  const { t } = useI18n();
  return (
    <Link to={`/complaints/${c.id}`} className="card group block p-4 transition-all hover:-translate-y-0.5 hover:border-accent/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted"><span dir="ltr">{c.ticket_no}</span> &middot; {c.category}</span>
        <StatusBadge status={c.status} />
      </div>
      <h3 className="mt-1.5 text-lg font-semibold leading-snug">{c.title}</h3>
      <p className="mt-1 text-sm text-muted">{c.building}, {c.room} &middot; {t('Reported')} {fmtDate(c.created_at)}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <PriorityTag priority={c.priority} />
        {c.has_voice && <span className="flex items-center gap-1 text-xs text-muted"><Mic className="h-3.5 w-3.5" />{t('Voice note')}</span>}
        {c.image_count > 0 && <span className="flex items-center gap-1 text-xs text-muted"><ImageIcon className="h-3.5 w-3.5" />{c.image_count}</span>}
        {c.affected > 1 && <span className="flex items-center gap-1 text-xs text-muted"><Users className="h-3.5 w-3.5" />{t('{n} people affected', { n: c.affected })}</span>}
        {c.is_overdue && <span className="text-xs font-semibold text-danger">{t('Taking longer than expected')}</span>}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api('/complaints/mine').then(setData).catch((e) => setErr(e.message)); }, []);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!data) return <PageLoader />;
  const s = data.summary;
  const stats = [['Pending', s.pending, 'pending'], ['In progress', s.in_progress, 'in_progress'], ['Resolved', s.resolved, 'resolved']];

  return (
    <div className="space-y-8 animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('Hi {name}', { name: user.name.split(' ')[0] })}</h1>
          <p className="mt-1 text-muted">{s.total ? t('You have reported {n} issue(s).', { n: s.total }) : t('Nothing reported yet.')}</p>
        </div>
        <Link to="/report/new" className="btn-primary"><Plus className="h-4 w-4" />{t('Report an issue')}</Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(([label, n, k]) => (
          <div key={k} className="card p-4"><div className="font-display text-3xl font-bold">{n}</div><span className={`badge badge-${k} mt-2`}>{t(label)}</span></div>
        ))}
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">{t('Recent complaints')}</h2>{s.total > 4 && <Link to="/complaints" className="text-sm font-medium text-accent hover:underline">{t('View all')}</Link>}</div>
        {data.complaints.length === 0
          ? <Empty title={t('No complaints yet')}>{t('Spotted a broken fan or a dead projector? Report it and we will keep you posted.')} <div className="mt-4"><Link to="/report/new" className="btn-primary">{t('Report your first issue')}</Link></div></Empty>
          : <div className="grid gap-3 md:grid-cols-2">{data.complaints.slice(0, 4).map((c) => <ComplaintRow key={c.id} c={c} />)}</div>}
      </section>
    </div>
  );
}
