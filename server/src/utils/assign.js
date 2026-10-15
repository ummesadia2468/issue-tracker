import { db, audit } from '../db.js';
import { notify } from './notify.js';

/**
 * Auto-assign: picks the active technician who covers this category and has the
 * fewest open complaints. Returns the technician id, or null if nobody covers it.
 */
export function autoAssign(complaintId, categoryId, ticketNo, title) {
  const tech = db.prepare(`
    SELECT u.id, u.name,
      (SELECT COUNT(*) FROM complaints c WHERE c.assigned_to = u.id AND c.status != 'resolved') AS open_count
    FROM users u JOIN technician_categories tc ON tc.user_id = u.id
    WHERE u.role = 'technician' AND u.blocked = 0 AND tc.category_id = ?
    ORDER BY open_count ASC, u.id ASC LIMIT 1`).get(categoryId);
  if (!tech) return null;
  db.prepare("UPDATE complaints SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?").run(tech.id, complaintId);
  audit(null, 'auto_assigned', 'complaint', complaintId, { technician: tech.name });
  notify(tech.id, complaintId, `New ${ticketNo} was assigned to you automatically: ${title}`);
  return tech;
}
