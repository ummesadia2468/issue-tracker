import { db } from '../db.js';
import { sendMail } from './mailer.js';
import { pushToUser } from './push.js';

/** Creates an in-app notification, sends a browser push, and (optionally) an email. */
export function notify(userId, complaintId, message, { email = true } = {}) {
  if (!userId) return;
  db.prepare('INSERT INTO notifications (user_id, complaint_id, message) VALUES (?,?,?)')
    .run(userId, complaintId ?? null, message);
  pushToUser(userId, { title: 'Issue Reporter', body: message, url: complaintId ? `/complaints/${complaintId}` : '/' }).catch(() => {});
  if (email) {
    const u = db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId);
    if (u) sendMail(u.email, 'Issue Reporter update', `Hi ${u.name},\n\n${message}\n`);
  }
}

export function notifyAdmins(complaintId, message) {
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND blocked = 0").all();
  admins.forEach((a) => notify(a.id, complaintId, message, { email: false }));
}
