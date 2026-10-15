import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { db, audit } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadComplaintFiles, verifyImageFiles, verifyAudioFile, removeFiles } from '../middleware/upload.js';
import { complaintSelect, shape, imagesFor, voiceFor, changeStatus, PRIORITIES, toIso } from '../utils/complaints.js';
import { notify, notifyAdmins } from '../utils/notify.js';
import { autoAssign } from '../utils/assign.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  category_id: z.coerce.number().int().positive('Choose a category.'),
  building: z.string().trim().min(1, 'Enter the building.').max(80),
  room: z.string().trim().min(1, 'Enter the room or lab.').max(80),
  priority: z.enum(PRIORITIES).default('medium'),
  title: z.string().trim().min(5, 'Give the issue a short title (5+ characters).').max(120),
  description: z.string().trim().max(2000).optional().default(''),
  anonymous: z.preprocess((v) => v === true || v === 'true' || v === '1' || v === 'on', z.boolean()),
});

// Open complaints about the same kind of problem in the same room, so people can say "me too"
// instead of filing a duplicate.
router.get('/duplicates', (req, res) => {
  const q = z.object({
    category_id: z.coerce.number().int(), building: z.string().trim().min(1), room: z.string().trim().min(1),
  }).safeParse(req.query);
  if (!q.success) return res.json({ duplicates: [] });
  const rows = db.prepare(`SELECT c.id, c.ticket_no, c.title, c.status, c.created_at, c.user_id,
      (SELECT COUNT(*) FROM complaint_supports s WHERE s.complaint_id = c.id) AS support_count,
      EXISTS (SELECT 1 FROM complaint_supports s WHERE s.complaint_id = c.id AND s.user_id = ?) AS supported
    FROM complaints c
    WHERE c.category_id = ? AND lower(c.building) = lower(?) AND lower(c.room) = lower(?) AND c.status != 'resolved'
    ORDER BY c.created_at DESC LIMIT 5`).all(req.user.id, q.data.category_id, q.data.building, q.data.room);
  res.json({
    duplicates: rows.map(({ user_id, ...r }) => ({
      ...r, created_at: toIso(r.created_at), supported: !!r.supported, mine: user_id === req.user.id, affected: r.support_count + 1,
    })),
  });
});

router.post('/', (req, res, next) => uploadComplaintFiles(req, res, (e) => (e ? next(e) : next())), (req, res) => {
  const images = req.files?.images || [];
  const voice = req.files?.voice?.[0];
  const all = [...images, ...(voice ? [voice] : [])];
  try {
    if (!verifyImageFiles(images)) { removeFiles(all); return res.status(400).json({ error: 'One of the photos is not a valid image.' }); }
    if (voice) {
      const bad = verifyAudioFile(voice);
      if (bad) { removeFiles(all); return res.status(400).json({ error: bad }); }
    }
    const d = createSchema.parse(req.body);
    if (!voice && d.description.length < 10) {
      removeFiles(all);
      return res.status(400).json({ error: 'Describe the problem in at least 10 characters, or record a voice note.', fields: { description: 'Describe the problem in at least 10 characters, or record a voice note.' } });
    }
    const description = d.description || '(Voice note only. Play the recording below.)';
    const cat = db.prepare('SELECT id, name FROM categories WHERE id = ? AND active = 1').get(d.category_id);
    if (!cat) { removeFiles(all); return res.status(400).json({ error: 'Choose a valid category.' }); }

    const id = db.transaction(() => {
      const info = db.prepare(`INSERT INTO complaints (user_id, anonymous, category_id, building, room, priority, title, description)
        VALUES (?,?,?,?,?,?,?,?)`).run(req.user.id, d.anonymous ? 1 : 0, d.category_id, d.building, d.room, d.priority, d.title, description);
      const cid = info.lastInsertRowid;
      db.prepare('UPDATE complaints SET ticket_no = ? WHERE id = ?').run(`TKT-${String(cid).padStart(5, '0')}`, cid);
      db.prepare('INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, note) VALUES (?,NULL,?,?,?)')
        .run(cid, 'pending', req.user.id, 'Complaint submitted');
      const ins = db.prepare('INSERT INTO images (complaint_id, filename, original_name, size) VALUES (?,?,?,?)');
      images.forEach((f) => ins.run(cid, f.filename, f.originalname, f.size));
      if (voice) db.prepare('INSERT INTO voice_notes (complaint_id, filename, size) VALUES (?,?,?)').run(cid, voice.filename, voice.size);
      return cid;
    })();

    const ticket = `TKT-${String(id).padStart(5, '0')}`;
    const tech = autoAssign(id, d.category_id, ticket, d.title);
    notifyAdmins(id, `New ${d.priority} priority ${cat.name.toLowerCase()} issue in ${d.building}, ${d.room}: ${d.title}${tech ? ` (auto-assigned to ${tech.name})` : ''}`);
    notify(req.user.id, id, `We received your complaint "${d.title}". Ticket ${ticket}.${tech ? ` ${tech.name} has been assigned.` : ''}`, { email: false });
    res.status(201).json({ id });
  } catch (e) { removeFiles(all); throw e; }
});

router.get('/mine', (req, res) => {
  const rows = db.prepare(`${complaintSelect} WHERE c.user_id = ? ORDER BY c.created_at DESC`).all(req.user.id);
  const imgCount = db.prepare('SELECT COUNT(*) n FROM images WHERE complaint_id = ?');
  const list = rows.map((r) => ({ ...shape(r, req.user), image_count: imgCount.get(r.id).n, affected: r.support_count + 1 }));
  res.json({
    complaints: list,
    summary: {
      total: list.length,
      pending: list.filter((c) => c.status === 'pending').length,
      in_progress: list.filter((c) => c.status === 'in_progress').length,
      resolved: list.filter((c) => c.status === 'resolved').length,
    },
  });
});

/** Loads a complaint and checks the viewer may see it. Returns null after sending the error. */
export function loadForViewer(req, res) {
  const row = db.prepare(`${complaintSelect} WHERE c.id = ?`).get(req.params.id);
  if (!row) { res.status(404).json({ error: 'Complaint not found.' }); return null; }
  const u = req.user;
  const allowed = u.role === 'admin' || row.user_id === u.id || (u.role === 'technician' && row.assigned_to === u.id);
  if (!allowed) { res.status(404).json({ error: 'Complaint not found.' }); return null; } // 404, not 403: don't reveal it exists
  return row;
}

router.get('/:id', (req, res) => {
  const row = loadForViewer(req, res);
  if (!row) return;
  const staff = req.user.role !== 'reporter';
  const hide = (uid) => row.anonymous && row.user_id !== req.user.id && uid === row.user_id; // keep anonymous reporters anonymous to staff
  const comments = db.prepare(`SELECT cm.id, cm.message, cm.internal, cm.created_at, cm.author_id, u.name AS author, u.role AS author_role
    FROM comments cm JOIN users u ON u.id = cm.author_id WHERE cm.complaint_id = ? ${staff ? '' : 'AND cm.internal = 0'}
    ORDER BY cm.created_at`).all(row.id).map(({ author_id, ...c }) => ({ ...c, author: hide(author_id) ? 'Anonymous' : c.author, internal: !!c.internal, created_at: toIso(c.created_at) }));
  const history = db.prepare(`SELECT h.old_status, h.new_status, h.note, h.created_at, h.changed_by AS changed_by_id, u.name AS changed_by
    FROM status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.complaint_id = ? ORDER BY h.created_at, h.id`)
    .all(row.id).map(({ changed_by_id, ...h }) => ({ ...h, changed_by: hide(changed_by_id) ? 'Anonymous' : h.changed_by, created_at: toIso(h.created_at) }));
  res.json({
    complaint: { ...shape(row, req.user), affected: row.support_count + 1 },
    images: imagesFor(row.id), voice: voiceFor(row.id), comments, history,
  });
});

// Reporter edits their own complaint (only while it is still pending)
router.patch('/:id', (req, res) => {
  const row = loadForViewer(req, res);
  if (!row) return;
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Only the reporter can edit this complaint.' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'This complaint is already being handled, so it can no longer be edited. Add a message instead.' });
  const d = z.object({
    title: z.string().trim().min(5, 'Give the issue a short title (5+ characters).').max(120).optional(),
    description: z.string().trim().min(10, 'Describe the problem in at least 10 characters.').max(2000).optional(),
    priority: z.enum(PRIORITIES).optional(),
  }).parse(req.body);
  db.prepare(`UPDATE complaints SET title = COALESCE(?, title), description = COALESCE(?, description),
    priority = COALESCE(?, priority), updated_at = datetime('now') WHERE id = ?`).run(d.title ?? null, d.description ?? null, d.priority ?? null, row.id);
  if (row.assigned_to) notify(row.assigned_to, row.id, `The reporter updated the details of ${row.ticket_no}.`, { email: false });
  res.json({ ok: true });
});

// Reporter withdraws (deletes) their own complaint while it is still pending
router.delete('/:id', (req, res) => {
  const row = loadForViewer(req, res);
  if (!row) return;
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Only the reporter can withdraw this complaint.' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'This complaint is already being handled, so it cannot be withdrawn.' });
  const files = [
    ...db.prepare('SELECT filename FROM images WHERE complaint_id = ?').all(row.id),
    ...db.prepare('SELECT filename FROM voice_notes WHERE complaint_id = ?').all(row.id),
  ];
  db.prepare('DELETE FROM complaints WHERE id = ?').run(row.id); // children are removed by ON DELETE CASCADE
  files.forEach((f) => fs.unlink(path.join(config.uploadDir, f.filename), () => {}));
  audit(req.user.id, 'complaint_withdrawn', 'complaint', row.id, { ticket: row.ticket_no });
  if (row.assigned_to) notify(row.assigned_to, null, `${row.ticket_no} was withdrawn by the reporter.`, { email: false });
  notifyAdmins(null, `${row.ticket_no} was withdrawn by the reporter.`);
  res.json({ ok: true });
});

// "Me too": add yourself to an existing complaint instead of filing a duplicate
router.post('/:id/support', (req, res) => {
  const row = db.prepare(`${complaintSelect} WHERE c.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Complaint not found.' });
  if (row.user_id === req.user.id) return res.status(400).json({ error: 'This is your own complaint.' });
  if (row.status === 'resolved') return res.status(400).json({ error: 'This issue was already resolved.' });
  const info = db.prepare('INSERT OR IGNORE INTO complaint_supports (complaint_id, user_id) VALUES (?,?)').run(row.id, req.user.id);
  const count = db.prepare('SELECT COUNT(*) n FROM complaint_supports WHERE complaint_id = ?').get(row.id).n;
  if (info.changes) {
    const affected = count + 1;
    notify(row.user_id, row.id, `${affected} people now report the same problem on ${row.ticket_no}.`, { email: false });
    // 3+ people affected: raise low/medium priority to high
    if (affected >= 3 && (row.priority === 'low' || row.priority === 'medium')) {
      db.prepare("UPDATE complaints SET priority = 'high', updated_at = datetime('now') WHERE id = ?").run(row.id);
      audit(null, 'priority_auto_raised', 'complaint', row.id, { from: row.priority, to: 'high', affected });
      notifyAdmins(row.id, `${row.ticket_no} affects ${affected} people. Priority raised to high automatically.`);
    }
  }
  res.json({ affected: count + 1, supported: true });
});

router.delete('/:id/support', (req, res) => {
  db.prepare('DELETE FROM complaint_supports WHERE complaint_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  const count = db.prepare('SELECT COUNT(*) n FROM complaint_supports WHERE complaint_id = ?').get(req.params.id).n;
  res.json({ affected: count + 1, supported: false });
});

router.post('/:id/comments', (req, res) => {
  const row = loadForViewer(req, res);
  if (!row) return;
  const { message, internal } = z.object({
    message: z.string().trim().min(1, 'Write a message first.').max(1000),
    internal: z.boolean().optional(),
  }).parse(req.body);
  const isStaff = req.user.role !== 'reporter';
  const isInternal = isStaff && !!internal; // reporters can never post internal notes
  db.prepare('INSERT INTO comments (complaint_id, author_id, message, internal) VALUES (?,?,?,?)')
    .run(row.id, req.user.id, message, isInternal ? 1 : 0);
  db.prepare("UPDATE complaints SET updated_at = datetime('now') WHERE id = ?").run(row.id);
  if (!isInternal) {
    if (isStaff) notify(row.user_id, row.id, `New reply on ${row.ticket_no}: ${message}`);
    else if (row.assigned_to) notify(row.assigned_to, row.id, `The reporter replied on ${row.ticket_no}.`, { email: false });
    else notifyAdmins(row.id, `The reporter replied on ${row.ticket_no}.`);
  }
  res.status(201).json({ ok: true });
});

router.post('/:id/reopen', (req, res) => {
  const row = loadForViewer(req, res);
  if (!row) return;
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Only the reporter can reopen a complaint.' });
  if (row.status !== 'resolved') return res.status(400).json({ error: 'Only resolved complaints can be reopened.' });
  const { reason } = z.object({ reason: z.string().trim().min(5, 'Tell us what is still wrong.').max(500) }).parse(req.body);
  changeStatus(row.id, 'pending', req.user.id, `Reopened by reporter: ${reason}`);
  db.prepare('UPDATE complaints SET reopen_count = reopen_count + 1, rating = NULL, rating_comment = NULL WHERE id = ?').run(row.id);
  (row.assigned_to ? notify(row.assigned_to, row.id, `${row.ticket_no} was reopened: ${reason}`)
    : notifyAdmins(row.id, `${row.ticket_no} was reopened: ${reason}`));
  res.json({ ok: true });
});

router.post('/:id/rate', (req, res) => {
  const row = loadForViewer(req, res);
  if (!row) return;
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Only the reporter can rate the resolution.' });
  if (row.status !== 'resolved') return res.status(400).json({ error: 'You can rate once the issue is resolved.' });
  const { rating, comment } = z.object({
    rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional(),
  }).parse(req.body);
  db.prepare('UPDATE complaints SET rating = ?, rating_comment = ? WHERE id = ?').run(rating, comment || null, row.id);
  res.json({ ok: true });
});

export default router;
