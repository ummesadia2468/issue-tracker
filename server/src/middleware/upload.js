import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { config } from '../config.js';

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const AUDIO = { 'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav' };
const baseType = (m = '') => m.split(';')[0].trim().toLowerCase(); // "audio/webm;codecs=opus" -> "audio/webm"
const extFor = (file) => (file.fieldname === 'voice' ? AUDIO : ALLOWED)[baseType(file.mimetype)];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  // Random server-generated name: never trust the client's filename
  filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + extFor(file)),
});

const fileFilter = (_req, file, cb) => {
  if (file.fieldname === 'voice')
    return AUDIO[baseType(file.mimetype)] ? cb(null, true) : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'That audio format is not supported.'));
  return ALLOWED[file.mimetype] ? cb(null, true) : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPG, PNG or WebP images are allowed.'));
};

const make = (maxFiles) =>
  multer({ storage, fileFilter, limits: { fileSize: config.maxUploadBytes, files: maxFiles } });

export const uploadImages = make(5).array('images', 5);
// Complaint form: up to 5 photos and 1 voice note (voice has its own, larger size cap below)
export const uploadComplaintFiles = multer({
  storage, fileFilter,
  limits: { fileSize: Math.max(config.maxUploadBytes, config.maxVoiceBytes), files: 6 },
}).fields([{ name: 'images', maxCount: 5 }, { name: 'voice', maxCount: 1 }]);
export const uploadPhoto = make(1).single('photo');

/** Verifies real file contents (magic bytes), not just the declared MIME type. */
export function verifyImageFiles(files = []) {
  const ok = files.every((f) => {
    const b = fs.readFileSync(f.path).subarray(0, 12);
    const jpg = b[0] === 0xff && b[1] === 0xd8;
    const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const webp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    return jpg || png || webp;
  });
  if (!ok) files.forEach((f) => fs.unlink(f.path, () => {}));
  return ok;
}

export const removeFiles = (files = []) => files.forEach((f) => fs.unlink(f.path, () => {}));

/** Checks real audio file signatures (webm/mkv, ogg, mp4/m4a, mp3, wav). */
export function verifyAudioFile(f) {
  if (f.size > config.maxVoiceBytes) { fs.unlink(f.path, () => {}); return 'Voice note is too long. Keep it under 60 seconds.'; }
  const b = fs.readFileSync(f.path).subarray(0, 12);
  const webm = b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  const ogg = b.toString('ascii', 0, 4) === 'OggS';
  const mp4 = b.toString('ascii', 4, 8) === 'ftyp';
  const mp3 = b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
  const wav = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE';
  if (!(webm || ogg || mp4 || mp3 || wav)) { fs.unlink(f.path, () => {}); return 'That file is not a valid audio recording.'; }
  return null;
}
