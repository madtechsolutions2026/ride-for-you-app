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
import { listPendingKyc, reviewKyc, reviewKycByUserId } from '../controllers/kyc.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Every admin route requires a valid JWT belonging to an ADMIN user.
router.use(authenticateToken, requireRole('ADMIN'));

// 1. Dashboard Overview Stats
router.get('/stats', getAdminStats);

// 2. Riders & Users
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);

// 3. Fleet & Vehicles
router.get('/fleet', getFleet);
router.post('/fleet/bikes', createBike);
router.put('/fleet/bikes/:id', updateBike);

// 4. Infrastructure (Hubs & Swap Stations)
router.get('/infrastructure', getHubsAndStations);
router.post('/hubs', createHub);
router.post('/swap-stations', createSwapStation);

// 5. KYC Review & Approvals
router.get('/kyc/pending', listPendingKyc);
router.get('/kyc/submissions', getKycSubmissions);
router.post('/kyc/review/:id', reviewKyc);
router.post('/kyc/review', reviewKycByUserId);

export default router;
