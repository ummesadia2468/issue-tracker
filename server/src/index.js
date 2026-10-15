import 'express-async-errors'; // makes thrown errors in async routes reach the error handler (Express 4)
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import './db.js';
import authRoutes from './routes/auth.js';
import complaintRoutes from './routes/complaints.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';
import { categories, notifications, push } from './routes/misc.js';
import { initPush } from './utils/push.js';
import { notFound, errorHandler } from './middleware/error.js';

fs.mkdirSync(config.uploadDir, { recursive: true });

const app = express();
app.set('trust proxy', 1);
const https = config.clientUrl.startsWith('https://');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // lets the Vite dev server show /uploads images
  // Google sign-in opens a popup and talks back to this page. Helmet's default ("same-origin") blocks that.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: config.isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      // Only force https when the site really is on https (otherwise plain-http LAN/localhost testing breaks)
      upgradeInsecureRequests: https ? [] : null,
      scriptSrc: ["'self'", 'https://accounts.google.com', 'https://accounts.google.com/gsi/'],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      connectSrc: ["'self'", 'https://accounts.google.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.googleusercontent.com'],
      mediaSrc: ["'self'", 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    },
  } : false,
}));
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (!config.isProd) app.use(morgan('dev'));

app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', index: false, setHeaders: (r) => r.setHeader('X-Content-Type-Options', 'nosniff') }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/categories', categories);
app.use('/api/notifications', notifications);
app.use('/api/push', push);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', notFound);

// In production, serve the built React app from this same server (one thing to deploy)
const dist = path.resolve(config.root, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    // The service worker and HTML must never be cached, or updates would not reach users
    setHeaders: (res, file) => { if (/(sw\.js|index\.html)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); },
  }));
  app.get('*', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
}

app.use(errorHandler);

initPush();

const server = app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
  console.log(config.googleClientId
    ? `Google sign-in: ON  (client ID ${config.googleClientId.slice(0, 12)}...)  allowed origin must be ${config.clientUrl}`
    : 'Google sign-in: OFF (no GOOGLE_CLIENT_ID in server/.env; run "npm run setup:google" to turn it on)');
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`\nPort ${config.port} is already in use. Close the other program, or set a different PORT in server/.env\n`);
  else console.error(err);
  process.exit(1);
});
