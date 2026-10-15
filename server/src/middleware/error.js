import multer from 'multer';
import { ZodError } from 'zod';
import { config } from '../config.js';

export const notFound = (_req, res) => res.status(404).json({ error: 'Not found.' });

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: err.issues[0]?.message || 'Invalid input.',
      fields: Object.fromEntries(err.issues.slice().reverse().map((i) => [i.path.join('.'), i.message])), // first message per field wins
    });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? `Each image must be under ${config.maxUploadBytes / 1024 / 1024} MB.`
      : err.code === 'LIMIT_FILE_COUNT' ? 'You can attach up to 5 images.'
      : typeof err.field === 'string' && err.field.includes(' ') ? err.field // our own readable message
      : 'Upload failed. Check the image type and size.';
    return res.status(400).json({ error: msg });
  }
  console.error(err);
  res.status(500).json({ error: config.isProd ? 'Something went wrong on our side.' : err.message });
}
