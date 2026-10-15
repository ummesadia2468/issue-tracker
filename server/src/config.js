import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.env.NODE_ENV === 'production';

// People often paste values with quotes or spaces around them; clean them so Google sign-in does not fail silently.
const clean = (v) => String(v || '').trim().replace(/^["']|["']$/g, '').trim();
const googleClientId = clean(process.env.GOOGLE_CLIENT_ID);
// Real Google web client IDs look like 1234567890-abcdef.apps.googleusercontent.com
const googleIdLooksValid = /^[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com$/i.test(googleClientId);
if (googleClientId && !googleIdLooksValid)
  console.warn('WARNING: GOOGLE_CLIENT_ID in server/.env does not look like a Google client ID (it should end with .apps.googleusercontent.com). Google sign-in will probably fail.');

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change-me'))) {
  console.error('FATAL: set a strong JWT_SECRET in production.');
  process.exit(1);
}

export const config = {
  isProd,
  root,
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-production',
  uploadDir: path.join(root, 'uploads'),
  dbPath: path.join(root, 'data', 'issues.db'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024,
  admin: {
    email: (process.env.ADMIN_EMAIL || '').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'System Admin',
  },
  googleClientId,
  // Optional: only these email domains may sign up / sign in, e.g. "myschool.edu.pk,staff.myschool.edu.pk"
  allowedDomains: (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean),
  maxVoiceBytes: 3 * 1024 * 1024,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Issue Reporter <no-reply@localhost>',
  },
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  // Hours allowed before a complaint counts as overdue (SLA), by priority
  slaHours: { urgent: 4, high: 24, medium: 72, low: 120 },
};
