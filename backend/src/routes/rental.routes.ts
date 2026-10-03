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
  getInvoicePaymentHandles,
} from '../controllers/rental.controller';
import {
  logBatterySwap,
  listMySwaps,
  createRentalRequest,
  listMyRentalRequests,
  cancelMyRentalRequest,
  reportDamage,
} from '../controllers/ride.controller';
import { getMyWallet } from '../controllers/wallet.controller';
import { authenticateToken } from '../middleware/auth';
import { uploadMany } from '../utils/uploads';

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
router.get('/invoices/:id/payment', authenticateToken, getInvoicePaymentHandles);
router.post('/invoices/:id/pay', authenticateToken, payWeeklyInvoice);

// Wallet — read-only by design. There is no top-up route; credit is issued by
// staff through POST /admin/api/wallet/:userId/credit.
router.get('/wallet', authenticateToken, getMyWallet);

// Battery swaps, logged by scanning a dock QR mid-rental.
router.post('/swaps', authenticateToken, logBatterySwap);
router.get('/swaps', authenticateToken, listMySwaps);

// Extension / return-slot requests against the rider's live rental.
router.post('/requests', authenticateToken, createRentalRequest);
router.get('/requests', authenticateToken, listMyRentalRequests);
router.post('/requests/:id/cancel', authenticateToken, cancelMyRentalRequest);

// Rider-reported damage, with up to 5 photos.
router.post('/damage', authenticateToken, uploadMany(5), reportDamage);

export default router;
