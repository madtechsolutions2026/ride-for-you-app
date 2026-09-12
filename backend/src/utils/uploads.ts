import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2, R2_BUCKET, isR2Configured } from './r2';

/**
 * Shared image upload for rider-submitted photos — support-ticket attachments
 * and damage evidence.
 *
 * KYC keeps its own upload handler because its documents carry extra rules
 * (fixed doc types, a field mapping into KycVerification). Everything else
 * goes through here: same private bucket, same size ceiling, same presigned
 * read path, just a caller-chosen folder.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

/** Run multer for one `file` field, answering JSON on failure instead of throwing. */
export function uploadSingle(req: Request, res: Response, next: NextFunction) {
  multerUpload.single('file')(req, res, (err: any) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ success: false, message: err.message || 'Upload failed' });
    }
    next();
  });
}

/** Same, for up to `max` files in a `files` field. */
export function uploadMany(max = 5) {
  return (req: Request, res: Response, next: NextFunction) => {
    multerUpload.array('files', max)(req, res, (err: any) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ success: false, message: err.message || 'Upload failed' });
      }
      next();
    });
  };
}

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * Put one image in the private bucket and return its key.
 *
 * Keys are namespaced by folder and owner and carry random bytes, so one
 * rider cannot guess another's key — and reads go through presignGet anyway.
 *
 * With R2 unconfigured (local dev, CI) this still returns a well-formed key
 * without storing bytes, so the surrounding flow stays testable.
 */
export async function putImage(
  folder: string,
  ownerId: string,
  file: UploadedFile,
): Promise<string> {
  const ext = ALLOWED_IMAGE_MIME[file.mimetype];
  if (!ext) {
    throw Object.assign(new Error('Only JPEG, PNG, WebP or HEIC images are accepted'), {
      status: 415,
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error('File exceeds the 8 MB limit'), { status: 413 });
  }

  const key = `${folder}/${ownerId}/${Date.now()}-${crypto
    .randomBytes(4)
    .toString('hex')}.${ext}`;

  if (isR2Configured && r2) {
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
  } else {
    console.warn(`[UPLOAD] R2 not configured. Generated test key: ${key}`);
  }

  return key;
}
