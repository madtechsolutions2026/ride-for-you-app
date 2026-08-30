import crypto from 'crypto';
import { Request, Response } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { r2, R2_BUCKET, isR2Configured, presignGet, PRESIGNED_URL_TTL_SECONDS } from '../utils/r2';

/**
 * KYC module.
 *
 * Rider endpoints  (JWT):        GET /kyc/me, POST /kyc/documents, POST /kyc/submit,
 *                                GET /kyc/history
 * Admin endpoints  (JWT + ADMIN): GET /kyc/admin/pending, GET /kyc/admin,
 *                                 GET /kyc/admin/:id, POST /kyc/admin/:id/review
 *
 * Documents live in a PRIVATE Cloudflare R2 bucket. POST /kyc/documents uploads one
 * file and returns its object key; the key is stored on the KycVerification row.
 * Every API response swaps those keys for short-lived presigned GET URLs.
 */

// Free-text fields accepted by POST /kyc/submit.
const TEXT_FIELDS = ['fullName', 'address', 'aadhaarNumber', 'panNumber'] as const;

// Document key fields: <submit body field> === <KycVerification column>.
const KEY_FIELDS = [
  'aadhaarFrontKey',
  'aadhaarBackKey',
  'panCardKey',
  'selfieKey',
  'addressProofKey',
] as const;

const USER_PREVIEW = {
  id: true,
  phone: true,
  fullName: true,
  email: true,
  city: true,
  avatarUrl: true,
} as const;

// Accepted docType -> the KycVerification key column it maps to.
const DOC_TYPES: Record<string, (typeof KEY_FIELDS)[number]> = {
  aadhaar_front: 'aadhaarFrontKey',
  aadhaar_back: 'aadhaarBackKey',
  pan_card: 'panCardKey',
  selfie: 'selfieKey',
  address_proof: 'addressProofKey',
};

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

function buildSubmissionData(
  body: Record<string, any>,
  userId: string
): { data?: Record<string, any>; error?: string } {
  const data: Record<string, any> = {};

  for (const key of TEXT_FIELDS) {
    const raw = body[key];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    data[key] = String(raw).trim();
  }

  if (body.dateOfBirth) {
    const d = new Date(body.dateOfBirth);
    if (!isNaN(d.getTime())) data.dateOfBirth = d;
  }

  // Backwards-compat: older mobile builds send `addressProof` as a plain address string.
  if (data.address === undefined && body.addressProof) {
    data.address = String(body.addressProof).trim();
  }

  // Document keys must be ones this rider actually uploaded (prefix guard).
  const prefix = `kyc/${userId}/`;
  for (const key of KEY_FIELDS) {
    const raw = body[key];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const value = String(raw).trim();
    if (!value.startsWith(prefix)) {
      return { error: `${key} is not a valid document reference` };
    }
    data[key] = value;
  }

  return { data };
}

/**
 * Shape a KycVerification row for an API response: object keys are replaced with
 * short-lived presigned GET URLs, the raw keys are never exposed.
 */
async function serialize(v: any) {
  const [aadhaarFrontUrl, aadhaarBackUrl, panCardUrl, selfieUrl, addressProofUrl] =
    await Promise.all([
      presignGet(v.aadhaarFrontKey),
      presignGet(v.aadhaarBackKey),
      presignGet(v.panCardKey),
      presignGet(v.selfieKey),
      presignGet(v.addressProofKey),
    ]);

  return {
    id: v.id,
    userId: v.userId,
    status: v.status,
    fullName: v.fullName,
    dateOfBirth: v.dateOfBirth,
    address: v.address,
    aadhaarNumber: v.aadhaarNumber,
    panNumber: v.panNumber,
    aadhaarFrontUrl,
    aadhaarBackUrl,
    panCardUrl,
    selfieUrl,
    addressProofUrl,
    documentUrlsExpireInSeconds: PRESIGNED_URL_TTL_SECONDS,
    rejectReason: v.rejectReason,
    reviewedBy: v.reviewedBy,
    reviewedAt: v.reviewedAt,
    submittedAt: v.submittedAt,
    ...(v.user ? { user: v.user } : {}),
  };
}

/** serialize() for a list of rows. */
function serializeMany(rows: any[]) {
  return Promise.all(rows.map((r) => serialize(r)));
}

/* -------------------------------------------------------------------------- */
/* Rider endpoints                                                             */
/* -------------------------------------------------------------------------- */

/** GET /kyc/me — the signed-in rider's KYC status and latest submission. */
export async function getMyKyc(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const latest = await prisma.kycVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });

    return res.json({
      kycStatus: user.kycStatus,
      canSubmit: user.kycStatus === 'PENDING' || user.kycStatus === 'REJECTED',
      latestSubmission: latest ? await serialize(latest) : null,
    });
  } catch (error: any) {
    console.error('Error in getMyKyc:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /kyc/documents  (multipart/form-data)
 *   fields: docType (aadhaar_front | aadhaar_back | pan_card | selfie | address_proof)
 *           file    (the image/PDF, <= 8 MB, jpeg/png/webp/pdf)
 * Uploads the file to the private R2 bucket and returns its object key. The client
 * calls this once per document, then passes the collected keys to POST /kyc/submit.
 */
export async function uploadKycDocument(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!isR2Configured || !r2) {
      return res.status(503).json({ error: 'Document storage is not configured' });
    }

    const docType = String(req.body?.docType ?? '').trim();
    const targetField = DOC_TYPES[docType];
    if (!targetField) {
      return res
        .status(400)
        .json({ error: `docType must be one of: ${Object.keys(DOC_TYPES).join(', ')}` });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'file is required (multipart field "file")' });
    }

    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) {
      return res
        .status(400)
        .json({ error: 'Unsupported file type. Allowed: JPEG, PNG, WebP, PDF.' });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'File exceeds the 8 MB limit' });
    }

    const key = `kyc/${userId}/${docType}-${Date.now()}-${crypto
      .randomBytes(4)
      .toString('hex')}.${ext}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    return res.status(201).json({
      docType,
      field: targetField, // the POST /kyc/submit body field this key belongs in
      key,
    });
  } catch (error: any) {
    console.error('Error in uploadKycDocument:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /kyc/submit — create a new verification and move the rider to SUBMITTED. */
export async function submitKyc(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.kycStatus === 'SUBMITTED') {
      return res.status(409).json({ error: 'A KYC submission is already under review' });
    }
    if (user.kycStatus === 'APPROVED') {
      return res.status(409).json({ error: 'KYC is already verified' });
    }

    const { data, error } = buildSubmissionData(req.body ?? {}, userId);
    if (error) return res.status(400).json({ error });
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No KYC details provided' });
    }

    const [verification] = await prisma.$transaction([
      prisma.kycVerification.create({ data: { userId, status: 'SUBMITTED', ...data } }),
      prisma.user.update({ where: { id: userId }, data: { kycStatus: 'SUBMITTED' } }),
    ]);

    console.log(`[KYC] ${user.phone} submitted verification ${verification.id}`);

    return res.status(201).json({
      message: 'KYC submitted successfully. Our team will review it shortly.',
      verification: await serialize(verification),
    });
  } catch (error: any) {
    console.error('Error in submitKyc:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /kyc/history — every submission the signed-in rider has ever made. */
export async function getMyKycHistory(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const items = await prisma.kycVerification.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });

    return res.json({ count: items.length, items: await serializeMany(items) });
  } catch (error: any) {
    console.error('Error in getMyKycHistory:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* Admin endpoints                                                             */
/* -------------------------------------------------------------------------- */

/** GET /kyc/admin/pending — the review queue (oldest first). */
export async function listPendingKyc(_req: Request, res: Response) {
  try {
    const items = await prisma.kycVerification.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { submittedAt: 'asc' },
      include: { user: { select: USER_PREVIEW } },
    });

    return res.json({ count: items.length, items: await serializeMany(items) });
  } catch (error: any) {
    console.error('Error in listPendingKyc:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /kyc/admin?status=APPROVED — all verifications, optional status filter. */
export async function listAllKyc(req: Request, res: Response) {
  try {
    const status =
      typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;

    const items = await prisma.kycVerification.findMany({
      where: status ? { status } : undefined,
      orderBy: { submittedAt: 'desc' },
      include: { user: { select: USER_PREVIEW } },
    });

    return res.json({ count: items.length, items: await serializeMany(items) });
  } catch (error: any) {
    console.error('Error in listAllKyc:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /kyc/admin/:id — one verification with full document details. */
export async function getKycById(req: Request, res: Response) {
  try {
    const verification = await prisma.kycVerification.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { ...USER_PREVIEW, kycStatus: true } } },
    });
    if (!verification) return res.status(404).json({ error: 'Verification not found' });

    return res.json({ verification: await serialize(verification) });
  } catch (error: any) {
    console.error('Error in getKycById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /kyc/admin/:id/review
 * Body: { action: "APPROVE" | "REJECT", reason?: string }
 * Applies the decision to the verification row and mirrors it onto User.kycStatus.
 */
export async function reviewKyc(req: AuthRequest, res: Response) {
  try {
    const reviewerId = req.user?.id;
    const { action, reason } = req.body ?? {};

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return res.status(400).json({ error: 'action must be "APPROVE" or "REJECT"' });
    }
    if (action === 'REJECT' && !reason) {
      return res.status(400).json({ error: 'reason is required when rejecting' });
    }

    const verification = await prisma.kycVerification.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!verification) return res.status(404).json({ error: 'Verification not found' });
    if (verification.status !== 'SUBMITTED') {
      return res
        .status(409)
        .json({ error: `Verification already ${verification.status.toLowerCase()}` });
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    const [updated] = await prisma.$transaction([
      prisma.kycVerification.update({
        where: { id: verification.id },
        data: {
          status: newStatus,
          reviewedBy: reviewerId ?? null,
          reviewedAt: new Date(),
          rejectReason: action === 'REJECT' ? String(reason) : null,
        },
      }),
      prisma.user.update({
        where: { id: verification.userId },
        data: { kycStatus: newStatus },
      }),
    ]);

    console.log(`[KYC] ${verification.user.phone} verification ${verification.id} -> ${newStatus}`);

    return res.json({
      message: `KYC ${newStatus.toLowerCase()} for ${verification.user.phone}`,
      verification: await serialize(updated),
    });
  } catch (error: any) {
    console.error('Error in reviewKyc:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* Backwards-compat helpers for the legacy /admin/kyc/* routes                  */
/* -------------------------------------------------------------------------- */

/** Legacy POST /admin/kyc/review — Body: { userId, action, reason? }. */
export async function reviewKycByUserId(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const latest = await prisma.kycVerification.findFirst({
      where: { userId, status: 'SUBMITTED' },
      orderBy: { submittedAt: 'desc' },
    });
    if (!latest) {
      return res.status(404).json({ error: 'No pending KYC submission for this user' });
    }

    req.params.id = latest.id;
    return reviewKyc(req, res);
  } catch (error: any) {
    console.error('Error in reviewKycByUserId:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
