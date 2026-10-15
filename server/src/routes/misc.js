import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toIso } from '../utils/complaints.js';
import { publicKey } from '../utils/push.js';
import { z } from 'zod';

export const categories = Router();
categories.get('/', (_req, res) =>
  res.json({ categories: db.prepare('SELECT id, name, icon FROM categories WHERE active = 1 ORDER BY id').all() }));

export const notifications = Router();
notifications.use(requireAuth);
notifications.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50').all(req.user.id)
    .map((n) => ({ ...n, is_read: !!n.is_read, created_at: toIso(n.created_at) }));
  const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).n;
  res.json({ notifications: rows, unread });
});
notifications.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});
notifications.post('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Browser push (alerts even when the tab is closed)
export const push = Router();
push.use(requireAuth);
push.get('/key', (_req, res) => res.json({ key: publicKey() }));
push.post('/subscribe', (req, res) => {
  const d = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }) }).parse(req.body);
  db.prepare(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`)
    .run(req.user.id, d.endpoint, d.keys.p256dh, d.keys.auth);
  res.json({ ok: true });
});
push.post('/unsubscribe', (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body);
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, req.user.id);
  res.json({ ok: true });
});
