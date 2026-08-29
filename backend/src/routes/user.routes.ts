import { Router } from 'express';
import { getProfile, updateProfile, submitKyc } from '../controllers/user.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All user routes require a valid JWT token
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/kyc/submit', authenticateToken, submitKyc);

export default router;
