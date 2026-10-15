import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

export const COOKIE = 'issue_token';

export function issueToken(res, user, remember = false) {
  const days = remember ? 30 : 1;
  const token = jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: `${days}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd && config.clientUrl.startsWith('https://'), // a Secure cookie is dropped on plain http
    maxAge: days * 86400_000,
  });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const { uid } = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    if (user.blocked) return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: 'You do not have permission to do that.' });

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, department: u.department,
  photo: u.photo, auth_provider: u.auth_provider, email_verified: !!u.email_verified,
  created_at: u.created_at,
});
