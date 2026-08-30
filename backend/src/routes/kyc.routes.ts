import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  getMyKyc,
  submitKyc,
  getMyKycHistory,
  uploadKycDocument,
  listPendingKyc,
  listAllKyc,
  getKycById,
  reviewKyc,
} from '../controllers/kyc.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Accept any file field name (e.g. "file", "adhar", "document", etc.)
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.any()(req, res, (err: any) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message || 'Upload failed' });
    }
    const files = (req as any).files as Express.Multer.File[];
    if (files && files.length > 0) {
      (req as any).file = files[0];
    }
    next();
  });
}

// --- Rider endpoints (any authenticated user) ---
router.get('/me', authenticateToken, getMyKyc);
router.post('/documents', authenticateToken, uploadSingle, uploadKycDocument);
router.post('/submit', authenticateToken, submitKyc);
router.get('/history', authenticateToken, getMyKycHistory);

// --- Admin endpoints (role ADMIN) ---
const admin = [authenticateToken, requireRole('ADMIN')];
router.get('/admin/pending', ...admin, listPendingKyc);
router.get('/admin', ...admin, listAllKyc);
router.get('/admin/:id', ...admin, getKycById);
router.post('/admin/:id/review', ...admin, reviewKyc);

export default router;
