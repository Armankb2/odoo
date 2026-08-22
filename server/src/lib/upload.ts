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

const IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const DOCUMENT_TYPES = new Map<string, string>([
  ...IMAGE_TYPES,
  ['application/pdf', '.pdf'],
]);

function uploader(allowed: Map<string, string>, maxBytes: number) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
      // The client-supplied filename is never used. It can contain "../",
      // control characters, or a second extension — none of which belong in a
      // path we write to.
      filename: (_req, file, cb) => {
        const ext = allowed.get(file.mimetype) ?? '';
        cb(null, `${crypto.randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!allowed.has(file.mimetype)) {
        return cb(validation(`Unsupported file type: ${file.mimetype}`));
      }
      cb(null, true);
    },
  });
}

/** Certificates and other attachments — images or PDF. */
export const upload = uploader(DOCUMENT_TYPES, 5 * 1024 * 1024);

/**
 * Avatars and logos. Images only: a profile picture that is a PDF renders as a
 * broken `<img>`, so it is rejected at the door rather than stored and served.
 */
export const uploadImage = uploader(IMAGE_TYPES, 5 * 1024 * 1024);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Public URL for a stored file. Served statically from /uploads. */
export const publicUrlFor = (filename: string) => `/uploads/${filename}`;

/**
 * Delete a file this app previously stored, given its public URL.
 *
 * Guarded deliberately. `avatarUrl` is a database column, and a column can
 * hold anything — an external URL, a path with "..", a value an earlier bug
 * wrote. Only a plain `/uploads/<basename>` is touched, and the resolved path
 * is re-checked to be inside UPLOAD_DIR before anything is unlinked. A missing
 * file is not an error: the goal is that it is gone.
 */
export function removeUploadedFile(publicUrl: string | null | undefined): void {
  if (!publicUrl || !publicUrl.startsWith('/uploads/')) return;

  const name = path.basename(publicUrl);
  if (!name || name === '.' || name === '..') return;

  const full = path.resolve(UPLOAD_DIR, name);
  if (path.dirname(full) !== UPLOAD_DIR) return;

  try {
    fs.unlinkSync(full);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[upload] could not remove', full, err);
    }
  }
}
