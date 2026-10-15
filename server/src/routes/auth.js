import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { db, audit } from '../db.js';
import { config } from '../config.js';
import { COOKIE, issueToken, requireAuth, publicUser } from '../middleware/auth.js';
import { uploadPhoto, verifyImageFiles, removeFiles } from '../middleware/upload.js';
import { sendMail } from '../utils/mailer.js';

const router = Router();
const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const password = z.string().min(8, 'Password must be at least 8 characters.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.').regex(/[0-9]/, 'Password must contain a number.');
const token = () => crypto.randomBytes(32).toString('hex');
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

const domainOk = (email) => !config.allowedDomains.length || config.allowedDomains.includes(email.split('@')[1]?.toLowerCase());
const domainMsg = () => `Only ${config.allowedDomains.map((d) => '@' + d).join(' or ')} email addresses can sign in here.`;

// Lets the frontend know which sign-in options to show
router.get('/config', (_req, res) =>
  res.json({
    googleClientId: config.googleClientId || null,
    allowedDomains: config.allowedDomains,
    requireEmailVerification: config.requireEmailVerification,
  }));

router.post('/register', limiter, async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2, 'Enter your full name.').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    password,
    department: z.string().trim().max(80).optional(),
  }).parse(req.body);

  if (!domainOk(body.email)) return res.status(403).json({ error: domainMsg(), fields: { email: domainMsg() } });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email))
    return res.status(409).json({ error: 'An account with this email already exists. Try signing in.', fields: { email: 'Already registered.' } });

  const verify = token();
  const info = db.prepare(`INSERT INTO users (name, email, password_hash, department, verify_token, email_verified)
    VALUES (?,?,?,?,?,0)`).run(body.name, body.email, await bcrypt.hash(body.password, 12), body.department || null, hash(verify));

  await sendMail(body.email, 'Verify your email',
    `Hi ${body.name},\n\nConfirm your email to finish setting up your account:\n${config.clientUrl}/verify-email?token=${verify}\n`);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  if (!config.requireEmailVerification) issueToken(res, user);
  res.status(201).json({
    user: publicUser(user),
    needsVerification: config.requireEmailVerification,
    message: config.requireEmailVerification ? 'Check your email to verify your account.' : 'Account created.',
  });
});

router.get('/verify-email', (req, res) => {
  const t = String(req.query.token || '');
  const user = t && db.prepare('SELECT id FROM users WHERE verify_token = ?').get(hash(t));
  if (!user) return res.status(400).json({ error: 'This verification link is invalid or has already been used.' });
  db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?').run(user.id);
  res.json({ message: 'Email verified. You can now sign in.' });
});

router.post('/login', limiter, async (req, res) => {
  const { email, password: pw, remember } = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    password: z.string().min(1, 'Enter your password.'),
    remember: z.boolean().optional(),
  }).parse(req.body);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Same message for unknown email and wrong password: avoids revealing which emails exist
  const bad = () => res.status(401).json({ error: 'Email or password is incorrect.' });
  if (!user) return bad();
  if (!user.password_hash)
    return res.status(400).json({ error: 'This account uses Google sign-in. Choose "Continue with Google".' });
  if (!(await bcrypt.compare(pw, user.password_hash))) return bad();
  if (user.blocked) return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
  if (config.requireEmailVerification && !user.email_verified)
    return res.status(403).json({ error: 'Verify your email first. Check your inbox for the link.' });

  issueToken(res, user, remember);
  res.json({ user: publicUser(user) });
});

router.post('/google', limiter, async (req, res) => {
  if (!googleClient) return res.status(501).json({ error: 'Google sign-in is not configured on this server.' });
  const { credential } = z.object({ credential: z.string().min(10) }).parse(req.body);

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch (e) {
    // The real reason (wrong client ID, expired token, clock off...) goes to the server console for the site owner
    console.error('[google] token check failed:', e.message);
    return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  }
  if (!payload?.email || !payload.email_verified)
    return res.status(401).json({ error: 'Your Google email is not verified.' });

  const email = payload.email.toLowerCase();
  let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(payload.sub, email);
  // Domain rule applies to new accounts; existing users (e.g. the admin) can always sign in
  if (!user && !domainOk(email)) return res.status(403).json({ error: domainMsg() });
  if (!user) {
    const info = db.prepare(`INSERT INTO users (name, email, photo, auth_provider, google_id, email_verified)
      VALUES (?,?,?,'google',?,1)`).run((payload.name || email.split('@')[0]).slice(0, 80), email, payload.picture || null, payload.sub);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  } else if (!user.google_id) {
    // Existing email/password account: link Google to it (Google already verified this email)
    db.prepare('UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?').run(payload.sub, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  } else if (user.google_id !== payload.sub) {
    // Same email but a different Google account than the one linked: refuse
    return res.status(403).json({ error: 'This email is linked to a different Google account.' });
  }
  if (user.blocked) return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
  issueToken(res, user, true);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/forgot-password', limiter, async (req, res) => {
  const { email } = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.') }).parse(req.body);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    const t = token();
    db.prepare("UPDATE users SET reset_token = ?, reset_expires = datetime('now','+1 hour') WHERE id = ?").run(hash(t), user.id);
    await sendMail(email, 'Reset your password',
      `Hi ${user.name},\n\nUse this link within 1 hour to choose a new password:\n${config.clientUrl}/reset-password?token=${t}\n\nIf you did not ask for this, ignore this email.`);
  }
  // Always the same response so attackers cannot discover registered emails
  res.json({ message: 'If that email is registered, a reset link is on its way.' });
});

router.post('/reset-password', limiter, async (req, res) => {
  const body = z.object({ token: z.string().min(10), password }).parse(req.body);
  const user = db.prepare("SELECT id FROM users WHERE reset_token = ? AND reset_expires > datetime('now')").get(hash(body.token));
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, email_verified = 1 WHERE id = ?')
    .run(await bcrypt.hash(body.password, 12), user.id);
  res.json({ message: 'Password updated. You can sign in now.' });
});

router.patch('/profile', requireAuth, (req, res, next) => uploadPhoto(req, res, (err) => (err ? next(err) : next())), (req, res) => {
  if (req.file && !verifyImageFiles([req.file])) return res.status(400).json({ error: 'That file is not a valid image.' });
  let body;
  try {
    body = z.object({
      name: z.string().trim().min(2, 'Enter your full name.').max(80).optional(),
      department: z.string().trim().max(80).optional(),
    }).parse(req.body);
  } catch (e) { removeFiles(req.file ? [req.file] : []); throw e; }

  db.prepare('UPDATE users SET name = COALESCE(?, name), department = COALESCE(?, department), photo = COALESCE(?, photo) WHERE id = ?')
    .run(body.name ?? null, body.department ?? null, req.file ? `/uploads/${req.file.filename}` : null, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

router.post('/change-password', requireAuth, limiter, async (req, res) => {
  const body = z.object({ current: z.string().optional(), password }).parse(req.body);
  const u = req.user;
  if (u.password_hash && !(await bcrypt.compare(body.current || '', u.password_hash)))
    return res.status(400).json({ error: 'Your current password is incorrect.', fields: { current: 'Incorrect.' } });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(body.password, 12), u.id);
  audit(u.id, 'password_changed', 'user', u.id);
  res.json({ message: 'Password updated.' });
});

export default router;
