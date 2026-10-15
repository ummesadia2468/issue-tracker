import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, STATUS_LABEL } from '../api';
import { useI18n } from '../i18n';
import { Empty, ErrorNote, PageLoader } from '../components/ui';
import { ComplaintRow } from './Dashboard';

export default function MyComplaints() {
  const { t } = useI18n();
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [filter, setFilter] = useState('all'); const [q, setQ] = useState('');
  useEffect(() => { api('/complaints/mine').then(setData).catch((e) => setErr(e.message)); }, []);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!data) return <PageLoader />;
  const list = data.complaints.filter((c) => (filter === 'all' || c.status === filter) && (!q || `${c.title} ${c.ticket_no} ${c.room} ${c.building}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-6 animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">{t('My complaints')}</h1><Link to="/report/new" className="btn-primary">{t('Report an issue')}</Link></div>
      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'in_progress', 'resolved'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} className={`btn !rounded-full !py-1.5 ${filter === s ? 'bg-accent text-accent-ink' : 'border border-line bg-surface'}`}>{s === 'all' ? t('All') : t(STATUS_LABEL[s])}</button>
        ))}
        <input className="input !w-full sm:!ms-auto sm:!w-64" placeholder={t('Search by title, room or ticket')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Search complaints')} />
      </div>
      {list.length === 0 ? <Empty title={t('No matching complaints')}>{data.complaints.length ? t('Try a different filter or search.') : t('You have not reported anything yet.')}</Empty>
        : <div className="grid gap-3 md:grid-cols-2">{list.map((c) => <ComplaintRow key={c.id} c={c} />)}</div>}
    </div>
  );
}
