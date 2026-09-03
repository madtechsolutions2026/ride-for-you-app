import { Router } from 'express';
import {
  getHub,
  listHubs,
  listSwapStations,
  listBikes,
  getBikeModel,
  createBooking,
  listMyBookings,
  getMyBooking,
  payBooking,
  cancelMyBooking,
  listMyRentals,
  getActiveRental,
  payWeeklyInvoice,
} from '../controllers/rental.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Rental discovery — RIDER, read-only. Any authenticated user.
router.get('/hub', authenticateToken, getHub);
router.get('/hubs', authenticateToken, listHubs);
router.get('/swap-stations', authenticateToken, listSwapStations);
router.get('/bikes', authenticateToken, listBikes);
router.get('/bikes/:modelId', authenticateToken, getBikeModel);

// Rider bookings. createBooking is KYC-gated inside the controller.
router.post('/bookings', authenticateToken, createBooking);
router.get('/bookings', authenticateToken, listMyBookings);
router.get('/bookings/:id', authenticateToken, getMyBooking);
router.post('/bookings/:id/pay', authenticateToken, payBooking);
router.post('/bookings/:id/cancel', authenticateToken, cancelMyBooking);

// Rider rentals + weekly rent. `/rentals/active` must precede any `/rentals/:id`.
router.get('/rentals/active', authenticateToken, getActiveRental);
router.get('/rentals', authenticateToken, listMyRentals);
router.post('/invoices/:id/pay', authenticateToken, payWeeklyInvoice);

export default router;
