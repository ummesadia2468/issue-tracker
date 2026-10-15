import webpush from 'web-push';
import { db } from '../db.js';
import { config } from '../config.js';

// VAPID keys identify this server to browser push services. Generated once, stored in the DB.
function keys() {
  const get = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value;
  let pub = get('vapid_public'), priv = get('vapid_private');
  if (!pub || !priv) {
    ({ publicKey: pub, privateKey: priv } = webpush.generateVAPIDKeys());
    const ins = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    ins.run('vapid_public', pub); ins.run('vapid_private', priv);
  }
  return { pub, priv };
}

let ready = false;
export function initPush() {
  try {
    const { pub, priv } = keys();
    webpush.setVapidDetails(`mailto:${config.admin.email || 'admin@example.com'}`, pub, priv);
    ready = true;
  } catch (e) { console.error('Push notifications disabled:', e.message); }
}

export const publicKey = () => (ready ? keys().pub : null);

/** Sends a browser push to every device the user enabled alerts on. Never throws. */
export async function pushToUser(userId, payload) {
  if (!ready) return;
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
    } catch (err) {
      // 404/410 = the device unsubscribed; forget it
      if (err.statusCode === 404 || err.statusCode === 410) db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
    }
  }));
}
