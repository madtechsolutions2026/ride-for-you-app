import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 client (S3-compatible).
 *
 * The KYC bucket is PRIVATE. Objects are uploaded with the account credentials and
 * read back only through short-lived presigned URLs minted per request — the object
 * keys are stored in the DB, never a public URL.
 *
 * Configure via .env:
 *   R2_ACCOUNT_ID           Cloudflare account id
 *   R2_ACCESS_KEY_ID        R2 API token access key
 *   R2_SECRET_ACCESS_KEY    R2 API token secret
 *   R2_BUCKET               bucket name
 *
 * When any of these is missing the client is null and upload endpoints return 503.
 */
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;

export const R2_BUCKET = process.env.R2_BUCKET || '';

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
