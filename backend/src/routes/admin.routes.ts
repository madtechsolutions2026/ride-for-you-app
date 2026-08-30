import { Router } from 'express';
import {
  getAdminStats,
  getAllUsers,
  updateUserStatus,
  getFleet,
  createBike,
  updateBike,
  getHubsAndStations,
  createHub,
  createSwapStation,
  getKycSubmissions,
} from '../controllers/admin.controller';
import {
  listPendingKyc,
  listAllKyc,
  getKycById,
  reviewKyc,
  reviewKycByUserId,
} from '../controllers/kyc.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Every admin route requires a valid JWT belonging to an ADMIN user.
router.use(authenticateToken, requireRole('ADMIN'));

// 1. Dashboard Metrics
router.get('/stats', getAdminStats);

// 2. Riders & Users
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);

// 3. Vehicles & Fleet
router.get('/fleet', getFleet);
router.post('/fleet/bikes', createBike);
router.put('/fleet/bikes/:id', updateBike);

// 4. Hubs & Swap Stations
router.get('/infrastructure', getHubsAndStations);
router.post('/hubs', createHub);
router.post('/swap-stations', createSwapStation);

// 5. KYC Review Queue & Submissions
router.get('/kyc/submissions', getKycSubmissions);
router.get('/kyc/pending', listPendingKyc);
router.get('/kyc/all', listAllKyc);
router.get('/kyc/:id', getKycById);
router.post('/kyc/review/:id', reviewKyc);
router.post('/kyc/review', reviewKycByUserId);

export default router;
