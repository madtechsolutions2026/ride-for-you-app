import { Router } from 'express';
import { getAllUsers } from '../controllers/admin.controller';
import { listPendingKyc, reviewKycByUserId } from '../controllers/kyc.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Every admin route requires a valid JWT belonging to an ADMIN user.
router.use(authenticateToken, requireRole('ADMIN'));

// Deprecated aliases — canonical routes live under /kyc/admin/*
router.get('/kyc/pending', listPendingKyc);
router.post('/kyc/review', reviewKycByUserId);

router.get('/users', getAllUsers);

export default router;
