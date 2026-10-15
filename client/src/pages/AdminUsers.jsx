import { useCallback, useEffect, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { api, fmtDate } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useToast } from '../toast';
import { Avatar, ErrorNote, PageLoader, Spinner } from '../components/ui';

export default function AdminUsers() {
  const { user: me } = useAuth(); const { t } = useI18n(); const toast = useToast();
  const [users, setUsers] = useState(null); const [cats, setCats] = useState([]); const [err, setErr] = useState('');
  const [search, setSearch] = useState(''); const [q, setQ] = useState('');
  const [newCat, setNewCat] = useState(''); const [catBusy, setCatBusy] = useState(false);

  useEffect(() => { const timer = setTimeout(() => setQ(search), 300); return () => clearTimeout(timer); }, [search]);
  const loadUsers = useCallback(() => api(`/admin/users?search=${encodeURIComponent(q)}`).then((d) => setUsers(d.users)).catch((e) => setErr(e.message)), [q]);
  const loadCats = useCallback(() => api('/admin/categories').then((d) => setCats(d.categories)).catch(() => {}), []);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadCats(); }, [loadCats]);

  const patch = async (u, body) => {
    try { await api(`/admin/users/${u.id}`, { method: 'PATCH', body }); toast(t('Saved.')); loadUsers(); } catch (e) { toast(t(e.message), 'err'); }
  };
  const toggleCat = async (u, cid) => {
    const ids = u.category_ids.includes(cid) ? u.category_ids.filter((x) => x !== cid) : [...u.category_ids, cid];
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, category_ids: ids } : x))); // optimistic
    try { await api(`/admin/users/${u.id}/categories`, { method: 'PUT', body: { category_ids: ids } }); } catch (e) { toast(t(e.message), 'err'); loadUsers(); }
  };
  const addCat = async (e) => {
    e.preventDefault(); if (!newCat.trim()) return; setCatBusy(true);
    try { await api('/admin/categories', { method: 'POST', body: { name: newCat.trim() } }); setNewCat(''); toast(t('Category added.')); loadCats(); } catch (x) { toast(t(x.message), 'err'); } finally { setCatBusy(false); }
  };
  const toggleActive = async (c) => { try { await api(`/admin/categories/${c.id}`, { method: 'PATCH', body: { active: !c.active } }); loadCats(); } catch (e) { toast(t(e.message), 'err'); } };

  if (err) return <ErrorNote>{err}</ErrorNote>;
  const activeCats = cats.filter((c) => c.active);

  return (
    <div className="animate-rise space-y-8">
      <div><h1 className="text-3xl font-bold">{t('Users')}</h1><p className="mt-1 text-muted">{t('Give someone the Technician role, then choose the problems they handle. New complaints in those categories are assigned to them automatically.')}</p></div>

      <section className="space-y-3">
        <div className="relative max-w-md"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input ps-10" placeholder={t('Search by name or email')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('Search users')} /></div>
        {!users ? <PageLoader /> : users.map((u) => {
          const self = u.id === me.id;
          return (
            <div key={u.id} className={`card p-4 ${u.blocked ? 'opacity-70' : ''}`}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar user={u} />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{u.name} {self && <span className="text-xs font-normal text-muted">({t('you')})</span>}</p><p className="truncate text-sm text-muted" dir="ltr">{u.email} &middot; {fmtDate(u.created_at.replace(' ', 'T') + 'Z')}</p></div>
                {u.blocked && <span className="badge bg-danger/15 text-danger">{t('Blocked')}</span>}
                <select className="input !w-auto" value={u.role} disabled={self} onChange={(e) => patch(u, { role: e.target.value })} aria-label={`${t('Role')}: ${u.name}`}>
                  <option value="reporter">{t('Reporter')}</option><option value="technician">{t('Technician')}</option><option value="admin">{t('Admin')}</option>
                </select>
                {!self && <button className={`btn ${u.blocked ? 'btn-ghost' : 'btn-ghost text-danger'}`} onClick={() => patch(u, { blocked: !u.blocked })}>{u.blocked ? t('Unblock') : t('Block')}</button>}
              </div>
              {u.role === 'technician' && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="mb-2 text-sm font-medium">{t('Handles these problems')}</p>
                  <div className="flex flex-wrap gap-2">
                    {activeCats.map((c) => { const on = u.category_ids.includes(c.id); return (
                      <button key={c.id} onClick={() => toggleCat(u, c.id)} aria-pressed={on} className={`btn !rounded-full !py-1.5 ${on ? 'bg-accent text-accent-ink' : 'border border-line bg-surface'}`}>{t(c.name)}</button>
                    ); })}
                  </div>
                  {u.category_ids.length === 0 && <p className="mt-2 text-xs text-[rgb(var(--pending-fg))]">{t('No categories chosen, so nothing is auto-assigned to this technician.')}</p>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-semibold">{t('Categories')}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {cats.map((c) => <li key={c.id}><button onClick={() => toggleActive(c)} aria-pressed={!!c.active} title={c.active ? t('Click to hide') : t('Click to show')} className={`btn !rounded-full !py-1.5 ${c.active ? 'border border-line bg-surface' : 'border border-dashed border-line text-muted line-through'}`}>{t(c.name)}</button></li>)}
        </ul>
        <form onSubmit={addCat} className="mt-4 flex max-w-md gap-2">
          <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t('New category, e.g. Air conditioner')} maxLength={40} aria-label={t('New category')} />
          <button className="btn-primary shrink-0" disabled={catBusy}>{catBusy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{t('Add')}</button>
        </form>
      </section>
    </div>
  );
}
