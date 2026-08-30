import { Router } from 'express';
import {
  getHub,
  listHubs,
  listSwapStations,
  listBikes,
  getBikeModel,
} from '../controllers/rental.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Rental discovery — RIDER, read-only. Any authenticated user.
router.get('/hub', authenticateToken, getHub);
router.get('/hubs', authenticateToken, listHubs);
router.get('/swap-stations', authenticateToken, listSwapStations);
router.get('/bikes', authenticateToken, listBikes);
router.get('/bikes/:modelId', authenticateToken, getBikeModel);

export default router;
