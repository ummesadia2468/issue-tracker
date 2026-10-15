import { db } from '../db.js';
import { config } from '../config.js';

export const STATUSES = ['pending', 'in_progress', 'resolved'];
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS" - convert to a real ISO string for the browser.
export const toIso = (s) => (s ? s.replace(' ', 'T') + 'Z' : s);

export function isOverdue(c) {
  if (c.status === 'resolved') return false;
  const hours = config.slaHours[c.priority] ?? 72;
  return Date.now() > new Date(toIso(c.created_at)).getTime() + hours * 3600_000;
}

export const complaintSelect = `
  SELECT c.*, cat.name AS category, cat.icon AS category_icon,
         u.name AS reporter_name, u.email AS reporter_email,
         t.name AS technician_name,
         (SELECT COUNT(*) FROM complaint_supports s WHERE s.complaint_id = c.id) AS support_count,
         (SELECT COUNT(*) FROM voice_notes v WHERE v.complaint_id = c.id) AS has_voice
  FROM complaints c
  JOIN categories cat ON cat.id = c.category_id
  JOIN users u ON u.id = c.user_id
  LEFT JOIN users t ON t.id = c.assigned_to`;

/** Shapes a row for the API. Staff never see who filed an anonymous complaint. */
export function shape(row, viewer) {
  if (!row) return null;
  const isOwner = viewer && row.user_id === viewer.id;
  const out = {
    ...row,
    anonymous: !!row.anonymous,
    has_voice: !!row.has_voice,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    resolved_at: toIso(row.resolved_at),
    is_overdue: isOverdue(row),
    sla_hours: config.slaHours[row.priority],
  };
  if (row.anonymous && !isOwner) {
    out.reporter_name = 'Anonymous';
    out.reporter_email = null;
    out.user_id = null;
  }
  return out;
}

export const imagesFor = (id) =>
  db.prepare('SELECT id, filename, original_name FROM images WHERE complaint_id = ?').all(id)
    .map((i) => ({ ...i, url: `/uploads/${i.filename}` }));

export function changeStatus(complaintId, newStatus, actorId, note) {
  const c = db.prepare('SELECT status FROM complaints WHERE id = ?').get(complaintId);
  if (!c || c.status === newStatus) return false;
  db.prepare(`UPDATE complaints SET status = ?, updated_at = datetime('now'),
              resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE NULL END WHERE id = ?`)
    .run(newStatus, newStatus, complaintId);
  db.prepare('INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, note) VALUES (?,?,?,?,?)')
    .run(complaintId, c.status, newStatus, actorId, note || null);
  return true;
}

export const voiceFor = (id) => {
  const v = db.prepare('SELECT filename FROM voice_notes WHERE complaint_id = ?').get(id);
  return v ? { url: `/uploads/${v.filename}` } : null;
};
