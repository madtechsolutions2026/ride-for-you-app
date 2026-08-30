import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 client (S3-compatible).
 *
 * Two buckets, split by sensitivity — not by feature:
 *
 *   R2_BUCKET         PRIVATE. KYC documents (Aadhaar, PAN, selfie). Objects are
 *                     uploaded with the account credentials and read back only
 *                     through short-lived presigned URLs minted per request — the
 *                     keys live in the DB, never a public URL.
 *   R2_PUBLIC_BUCKET  PUBLIC. Catalogue assets (bike images, marketing art).
 *                     Served through a Cloudflare public/CDN domain
 *                     (R2_PUBLIC_BASE_URL), so URLs are stable and edge-cached —
 *                     no signing round-trip on every render.
 *
 * Configure via .env:
 *   R2_ACCOUNT_ID           Cloudflare account id
 *   R2_ACCESS_KEY_ID        R2 API token access key       (shared by both buckets)
 *   R2_SECRET_ACCESS_KEY    R2 API token secret
 *   R2_BUCKET               private bucket name
 *   R2_PUBLIC_BUCKET        public bucket name             (uploads — later slice)
 *   R2_PUBLIC_BASE_URL      public/CDN base, e.g. https://cdn.rideforyou.app
 *
 * When the private-bucket vars are missing the S3 client is null and upload
 * endpoints return 503. When R2_PUBLIC_BASE_URL is missing, publicUrl() returns
 * null and clients fall back to bundled artwork.
 */
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;

export const R2_BUCKET = process.env.R2_BUCKET || '';
export const R2_PUBLIC_BUCKET = process.env.R2_PUBLIC_BUCKET || '';
export const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

export const isR2Configured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
);

export const r2 = isR2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID as string,
        secretAccessKey: R2_SECRET_ACCESS_KEY as string,
      },
    })
  : null;

/** How long a presigned document URL stays valid. */
export const PRESIGNED_URL_TTL_SECONDS = 900; // 15 minutes

/**
 * Mint a short-lived GET URL for a private object.
 * Returns null when R2 is not configured, no key is given, or signing fails.
 */
export async function presignGet(key?: string | null): Promise<string | null> {
  if (!key || !isR2Configured || !r2) return null;
  try {
    return await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
    });
  } catch (err) {
    console.error('presignGet failed for key', key, err);
    return null;
  }
}

/**
 * Stable public URL for an object in the PUBLIC bucket (bike images, etc.).
 * No signing — the bucket is served through R2_PUBLIC_BASE_URL and edge-cached.
 * Returns null when R2_PUBLIC_BASE_URL is unset or no key is given.
 */
export function publicUrl(key?: string | null): string | null {
  if (!key || !R2_PUBLIC_BASE_URL) return null;
  return `${R2_PUBLIC_BASE_URL}/${String(key).replace(/^\/+/, '')}`;
}
