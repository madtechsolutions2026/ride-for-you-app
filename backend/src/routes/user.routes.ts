import { Router } from 'express';
import { getProfile, updateProfile, registerPushToken } from '../controllers/user.controller';
import { submitKyc } from '../controllers/kyc.controller';
import {
  listMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All user routes require a valid JWT token
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/push-token', authenticateToken, registerPushToken);

// In-app notification inbox. '/unread-count' and '/read-all' are declared
// before the ':id' route so they are not swallowed as ids.
router.get('/notifications', authenticateToken, listMyNotifications);
router.get('/notifications/unread-count', authenticateToken, getUnreadCount);
router.post('/notifications/read-all', authenticateToken, markAllNotificationsRead);
router.post('/notifications/:id/read', authenticateToken, markNotificationRead);

// Deprecated alias — canonical route is POST /kyc/submit
router.post('/kyc/submit', authenticateToken, submitKyc);

export default router;
