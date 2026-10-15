import { Router } from 'express';
import { z } from 'zod';
import { db, audit } from '../db.js';
import { requireAuth, requireRole, publicUser } from '../middleware/auth.js';
import { complaintSelect, shape, changeStatus, STATUSES, PRIORITIES, toIso } from '../utils/complaints.js';
import { notify } from '../utils/notify.js';

const router = Router();
router.use(requireAuth);

// ---------- Complaints (admins see all, technicians only their assigned ones) ----------
const staff = requireRole('admin', 'technician');

router.get('/complaints', staff, (req, res) => {
  const q = z.object({
    status: z.enum(STATUSES).optional(), priority: z.enum(PRIORITIES).optional(),
    category_id: z.coerce.number().int().optional(), assigned_to: z.coerce.number().int().optional(),
    building: z.string().optional(), overdue: z.enum(['true']).optional(),
    from: z.string().optional(), to: z.string().optional(), search: z.string().trim().optional(),
    sort: z.enum(['created_at', 'updated_at', 'priority', 'status', 'support_count']).default('created_at'),
    dir: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1), page_size: z.coerce.number().int().min(1).max(100).default(20),
  }).parse(req.query);

  const where = []; const args = [];
  const add = (sql, ...a) => { where.push(sql); args.push(...a); };
  if (req.user.role === 'technician') add('c.assigned_to = ?', req.user.id);
  if (q.status) add('c.status = ?', q.status);
  if (q.priority) add('c.priority = ?', q.priority);
  if (q.category_id) add('c.category_id = ?', q.category_id);
  if (q.assigned_to) add('c.assigned_to = ?', q.assigned_to);
  if (q.building) add('lower(c.building) = lower(?)', q.building);
  if (q.from) add('date(c.created_at) >= date(?)', q.from);
  if (q.to) add('date(c.created_at) <= date(?)', q.to);
  if (q.search) {
    const s = `%${q.search}%`;
    add('(c.title LIKE ? OR c.description LIKE ? OR c.ticket_no LIKE ? OR c.room LIKE ? OR c.building LIKE ?)', s, s, s, s, s);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = q.sort === 'priority'
    ? `CASE c.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END ${q.dir}`
    : q.sort === 'support_count' ? `support_count ${q.dir}` : `c.${q.sort} ${q.dir}`;

  let rows = db.prepare(`${complaintSelect} ${clause} ORDER BY ${order}, c.id DESC`).all(...args).map((r) => shape(r, req.user));
  if (q.overdue) rows = rows.filter((r) => r.is_overdue);
  const total = rows.length;
  rows = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  res.json({ complaints: rows, total, page: q.page, page_size: q.page_size });
});

router.patch('/complaints/:id', staff, (req, res) => {
  const row = db.prepare(`${complaintSelect} WHERE c.id = ?`).get(req.params.id);
  if (!row || (req.user.role === 'technician' && row.assigned_to !== req.user.id))
    return res.status(404).json({ error: 'Complaint not found.' });

  const d = z.object({
    status: z.enum(STATUSES).optional(), priority: z.enum(PRIORITIES).optional(),
    assigned_to: z.number().int().nullable().optional(), note: z.string().trim().max(500).optional(),
  }).parse(req.body);
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && (d.priority !== undefined || d.assigned_to !== undefined))
    return res.status(403).json({ error: 'Only admins can change priority or assignment.' });

  const changes = {};
  db.transaction(() => {
    if (d.assigned_to !== undefined && d.assigned_to !== row.assigned_to) {
      if (d.assigned_to !== null) {
        const t = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'technician' AND blocked = 0").get(d.assigned_to);
        if (!t) throw Object.assign(new Error('Choose an active technician.'), { status: 400 });
      }
      db.prepare("UPDATE complaints SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?").run(d.assigned_to, row.id);
      changes.assigned_to = d.assigned_to;
      if (d.assigned_to) notify(d.assigned_to, row.id, `You were assigned ${row.ticket_no}: ${row.title} (${row.building}, ${row.room}).`);
    }
    if (d.priority && d.priority !== row.priority) {
      db.prepare("UPDATE complaints SET priority = ?, updated_at = datetime('now') WHERE id = ?").run(d.priority, row.id);
      changes.priority = d.priority;
    }
    if (d.status && changeStatus(row.id, d.status, req.user.id, d.note)) {
      changes.status = d.status;
      const label = d.status.replace('_', ' ');
      notify(row.user_id, row.id, `Your complaint ${row.ticket_no} is now ${label}.${d.note ? ' Note: ' + d.note : ''}`);
    }
    if (Object.keys(changes).length) audit(req.user.id, 'complaint_updated', 'complaint', row.id, changes);
  })();
  res.json({ complaint: shape(db.prepare(`${complaintSelect} WHERE c.id = ?`).get(row.id), req.user) });
});

router.post('/complaints/bulk', requireRole('admin'), (req, res) => {
  const d = z.object({
    ids: z.array(z.number().int()).min(1, 'Select at least one complaint.').max(200),
    status: z.enum(STATUSES).optional(), assigned_to: z.number().int().nullable().optional(),
  }).parse(req.body);
  let updated = 0;
  db.transaction(() => {
    for (const id of d.ids) {
      const row = db.prepare('SELECT ticket_no, user_id FROM complaints WHERE id = ?').get(id);
      if (!row) continue;
      if (d.status && changeStatus(id, d.status, req.user.id, 'Bulk update')) {
        notify(row.user_id, id, `Your complaint ${row.ticket_no} is now ${d.status.replace('_', ' ')}.`);
        updated++;
      }
      if (d.assigned_to !== undefined) {
        db.prepare("UPDATE complaints SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?").run(d.assigned_to, id);
        if (d.assigned_to) notify(d.assigned_to, id, `You were assigned ${row.ticket_no}.`);
        updated++;
      }
    }
    audit(req.user.id, 'bulk_update', 'complaint', null, d);
  })();
  res.json({ updated });
});

router.get('/technicians', staff, (_req, res) =>
  res.json({ technicians: db.prepare("SELECT id, name, email FROM users WHERE role = 'technician' AND blocked = 0 ORDER BY name").all() }));

// ---------- Users (admin only) ----------
router.get('/users', requireRole('admin'), (req, res) => {
  const s = `%${String(req.query.search || '')}%`;
  const rows = db.prepare('SELECT * FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT 200').all(s, s);
  const cats = db.prepare('SELECT category_id FROM technician_categories WHERE user_id = ?');
  res.json({
    users: rows.map((u) => ({
      ...publicUser(u), blocked: !!u.blocked,
      category_ids: u.role === 'technician' ? cats.all(u.id).map((c) => c.category_id) : [],
    })),
  });
});

router.patch('/users/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const d = z.object({ role: z.enum(['reporter', 'technician', 'admin']).optional(), blocked: z.boolean().optional() }).parse(req.body);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role or block yourself.' });
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  if (d.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(d.role, id);
  if (d.blocked !== undefined) db.prepare('UPDATE users SET blocked = ? WHERE id = ?').run(d.blocked ? 1 : 0, id);
  audit(req.user.id, 'user_updated', 'user', id, d);
  res.json({ user: { ...publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)), blocked: d.blocked ?? undefined } });
});

// Which categories a technician covers (drives auto-assignment)
router.put('/users/:id/categories', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const { category_ids } = z.object({ category_ids: z.array(z.number().int()).max(50) }).parse(req.body);
  const u = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'technician'").get(id);
  if (!u) return res.status(400).json({ error: 'Only technicians can be given categories.' });
  db.transaction(() => {
    db.prepare('DELETE FROM technician_categories WHERE user_id = ?').run(id);
    const ins = db.prepare('INSERT OR IGNORE INTO technician_categories (user_id, category_id) SELECT ?, id FROM categories WHERE id = ?');
    category_ids.forEach((cid) => ins.run(id, cid));
  })();
  audit(req.user.id, 'technician_categories_set', 'user', id, { category_ids });
  res.json({ ok: true });
});

// ---------- Categories (admin only) ----------
router.get('/categories', requireRole('admin'), (_req, res) =>
  res.json({ categories: db.prepare('SELECT id, name, icon, active FROM categories ORDER BY id').all() }));

router.post('/categories', requireRole('admin'), (req, res) => {
  const d = z.object({ name: z.string().trim().min(2).max(40), icon: z.string().trim().max(30).default('wrench') }).parse(req.body);
  try {
    const info = db.prepare('INSERT INTO categories (name, icon) VALUES (?,?)').run(d.name, d.icon);
    audit(req.user.id, 'category_created', 'category', info.lastInsertRowid, d);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch { res.status(409).json({ error: 'A category with that name already exists.' }); }
});

router.patch('/categories/:id', requireRole('admin'), (req, res) => {
  const d = z.object({ name: z.string().trim().min(2).max(40).optional(), active: z.boolean().optional() }).parse(req.body);
  db.prepare('UPDATE categories SET name = COALESCE(?, name), active = COALESCE(?, active) WHERE id = ?')
    .run(d.name ?? null, d.active === undefined ? null : d.active ? 1 : 0, req.params.id);
  audit(req.user.id, 'category_updated', 'category', Number(req.params.id), d);
  res.json({ ok: true });
});

// ---------- Audit log (admin only) ----------
router.get('/audit', requireRole('admin'), (_req, res) => {
  const rows = db.prepare(`SELECT a.*, u.name AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    ORDER BY a.id DESC LIMIT 200`).all().map((a) => ({ ...a, created_at: toIso(a.created_at), details: a.details ? JSON.parse(a.details) : null }));
  res.json({ entries: rows });
});

export default router;
