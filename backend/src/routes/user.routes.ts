import { Router } from 'express';
import { getProfile, updateProfile, registerPushToken } from '../controllers/user.controller';
import { submitKyc } from '../controllers/kyc.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All user routes require a valid JWT token
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/push-token', authenticateToken, registerPushToken);

// Deprecated alias — canonical route is POST /kyc/submit
router.post('/kyc/submit', authenticateToken, submitKyc);

export default router;
