import { Router } from 'express';
import { getPendingKyc, reviewKyc, getAllUsers } from '../controllers/admin.controller';

const router = Router();

// Admin KYC Review endpoints
router.get('/kyc/pending', getPendingKyc);
router.post('/kyc/review', reviewKyc);
router.get('/users', getAllUsers);

export default router;
