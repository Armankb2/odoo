import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { validation } from './errors';

/**
 * Local disk uploads: sick-leave certificates, avatars, company logos.
 * No S3 — it would not earn its setup cost here.
 */

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
]);

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    // The client-supplied filename is never used. It can contain "../",
    // control characters, or a second extension — none of which belong in a
    // path we write to.
    filename: (_req, file, cb) => {
      const ext = ALLOWED.get(file.mimetype) ?? '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(validation(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

/** Public URL for a stored file. Served statically from /uploads. */
export const publicUrlFor = (filename: string) => `/uploads/${filename}`;
