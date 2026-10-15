import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { complaintSelect, shape, toIso } from '../utils/complaints.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

function range(q) {
  const where = []; const args = [];
  if (q.from) { where.push('date(c.created_at) >= date(?)'); args.push(q.from); }
  if (q.to) { where.push('date(c.created_at) <= date(?)'); args.push(q.to); }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

function compute(q) {
  const { clause, args } = range(q);
  const and = clause ? `${clause} AND` : 'WHERE';
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const all = (sql, ...a) => db.prepare(sql).all(...a);

  const byStatus = all(`SELECT c.status, COUNT(*) n FROM complaints c ${clause} GROUP BY c.status`, ...args);
  const get = (s) => byStatus.find((r) => r.status === s)?.n || 0;
  const avg = one(`SELECT AVG((julianday(c.resolved_at) - julianday(c.created_at)) * 24) h FROM complaints c ${and} c.resolved_at IS NOT NULL`, ...args).h;
  const rating = one(`SELECT AVG(c.rating) r, COUNT(c.rating) n FROM complaints c ${and} c.rating IS NOT NULL`, ...args);
  const open = all(`${complaintSelect} WHERE c.status != 'resolved'`).map((r) => shape(r, null));

  return {
    totals: { total: get('pending') + get('in_progress') + get('resolved'), pending: get('pending'), in_progress: get('in_progress'), resolved: get('resolved'), overdue: open.filter((o) => o.is_overdue).length },
    avg_resolution_hours: avg == null ? null : Math.round(avg * 10) / 10,
    avg_rating: rating.r == null ? null : Math.round(rating.r * 10) / 10, ratings_count: rating.n,
    by_category: all(`SELECT cat.name, COUNT(*) n FROM complaints c JOIN categories cat ON cat.id = c.category_id ${clause} GROUP BY cat.id ORDER BY n DESC`, ...args),
    by_status: [{ name: 'Pending', n: get('pending') }, { name: 'In progress', n: get('in_progress') }, { name: 'Resolved', n: get('resolved') }],
    by_priority: all(`SELECT c.priority name, COUNT(*) n FROM complaints c ${clause} GROUP BY c.priority`, ...args),
    over_time: all(`SELECT date(c.created_at) day, COUNT(*) reported, SUM(c.status = 'resolved') resolved FROM complaints c ${clause} GROUP BY day ORDER BY day`, ...args),
    hotspots: all(`SELECT c.building, c.room, COUNT(*) n FROM complaints c ${clause} GROUP BY lower(c.building), lower(c.room) ORDER BY n DESC LIMIT 10`, ...args),
    technicians: all(`SELECT u.id, u.name, COUNT(c.id) assigned, COALESCE(SUM(c.status = 'resolved'), 0) resolved,
        ROUND(AVG(CASE WHEN c.resolved_at IS NOT NULL THEN (julianday(c.resolved_at) - julianday(c.created_at)) * 24 END), 1) avg_hours
      FROM users u LEFT JOIN complaints c ON c.assigned_to = u.id ${clause.replace('WHERE', 'AND')}
      WHERE u.role = 'technician' GROUP BY u.id ORDER BY resolved DESC`, ...args),
  };
}

router.get('/', (req, res) => res.json(compute(req.query)));

const rowsForExport = (q) => {
  const { clause, args } = range(q);
  return db.prepare(`${complaintSelect} ${clause} ORDER BY c.created_at DESC`).all(...args).map((r) => shape(r, null));
};

router.get('/export.csv', (req, res) => {
  const esc = (v) => { const s = String(v ?? ''); return /^[=+\-@]/.test(s) ? `"'${s.replace(/"/g, '""')}"` : /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; // also blocks CSV formula injection
  const head = ['Ticket', 'Title', 'Category', 'Building', 'Room', 'Priority', 'Status', 'Reporter', 'Technician', 'Created', 'Resolved', 'Overdue', 'Rating'];
  const lines = rowsForExport(req.query).map((c) => [c.ticket_no, c.title, c.category, c.building, c.room, c.priority, c.status, c.reporter_name, c.technician_name, c.created_at, c.resolved_at, c.is_overdue ? 'yes' : 'no', c.rating].map(esc).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="complaints-report.csv"');
  res.send([head.join(','), ...lines].join('\n'));
});

router.get('/export.pdf', (req, res) => {
  const s = compute(req.query);
  const rows = rowsForExport(req.query);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="complaints-report.pdf"');
  doc.pipe(res);
  doc.fontSize(20).text('Issue Report');
  doc.fontSize(10).fillColor('#555').text(`Period: ${req.query.from || 'start'} to ${req.query.to || 'today'}   Generated: ${new Date().toLocaleString()}`).moveDown();
  doc.fillColor('#000').fontSize(12).text(`Total ${s.totals.total}   Pending ${s.totals.pending}   In progress ${s.totals.in_progress}   Resolved ${s.totals.resolved}   Overdue ${s.totals.overdue}`);
  doc.text(`Average resolution time: ${s.avg_resolution_hours ?? 'n/a'} hours`).moveDown();
  doc.fontSize(13).text('By category');
  s.by_category.forEach((c) => doc.fontSize(10).text(`${c.name}: ${c.n}`));
  doc.moveDown().fontSize(13).text('Hotspots');
  s.hotspots.forEach((h) => doc.fontSize(10).text(`${h.building}, ${h.room}: ${h.n}`));
  doc.moveDown().fontSize(13).text('Complaints');
  rows.slice(0, 300).forEach((c) => doc.fontSize(9).text(`${c.ticket_no}  [${c.status}] ${c.priority}  ${c.category}  ${c.building}/${c.room}  ${c.title}`, { width: 515 }));
  doc.end();
});

export default router;
