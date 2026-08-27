import { Router } from 'express';
import { requestOtp, verifyOtp, refreshToken, logout, getCurrentUser } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/otp/request', requestOtp);
router.post('/otp/verify', verifyOtp);
router.post('/token/refresh', refreshToken);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);

export default router;
