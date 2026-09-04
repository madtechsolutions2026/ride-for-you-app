import { Router } from 'express';
import {
  getAdminStats,
  getAllUsers,
  getUserDetail,
  updateUserStatus,
  getFleet,
  createBike,
  updateBike,
  createBikeModel,
  updateBikeModel,
  upsertRentalPlan,
  getHubsAndStations,
  createHub,
  updateHub,
  createSwapStation,
  getKycSubmissions,
  getFleetMap,
} from '../controllers/admin.controller';
import {
  listPendingKyc,
  listAllKyc,
  getKycById,
  reviewKyc,
  reviewKycByUserId,
} from '../controllers/kyc.controller';
import {
  listBookings,
  getBookingDetail,
  confirmBooking,
  cancelBooking,
  handoverBike,
  listRentals,
  returnRental,
  closeRental,
  listInvoices,
  markInvoicePaid,
  sendInvoiceReminder,
  listPayments,
  recordManualPayment,
  refundPayment,
  listDamage,
  logDamage,
  resolveDamage,
  listRecovery,
  createRecovery,
  updateRecovery,
} from '../controllers/ops.controller';
import { listStaff, createStaff, updateStaff, revokeStaff } from '../controllers/staff.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Any staff role may reach the dashboard; the sensitive actions below add an
// extra ADMIN-only guard inline.
const staff = requireRole('ADMIN', 'EXECUTIVE', 'SUPPORT');
const adminOnly = requireRole('ADMIN');

router.use(authenticateToken, staff);

/* -------- Dashboard -------- */
router.get('/stats', getAdminStats);

/* -------- Riders & users -------- */
router.get('/users', getAllUsers);
router.get('/users/:id/detail', getUserDetail);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/status', adminOnly, updateUserStatus);

/* -------- Employees / staff (ADMIN only) -------- */
router.get('/staff', adminOnly, listStaff);
router.post('/staff', adminOnly, createStaff);
router.put('/staff/:id', adminOnly, updateStaff);
router.delete('/staff/:id', adminOnly, revokeStaff);

/* -------- Fleet: models, plans, physical bikes, live map -------- */
router.get('/fleet', getFleet);
router.get('/fleet/map', getFleetMap);
router.post('/fleet/bikes', createBike);
router.put('/fleet/bikes/:id', updateBike);
router.post('/fleet/models', adminOnly, createBikeModel);
router.put('/fleet/models/:id', adminOnly, updateBikeModel);
router.post('/fleet/plans', adminOnly, upsertRentalPlan);

/* -------- Hubs & swap stations -------- */
router.get('/infrastructure', getHubsAndStations);
router.post('/hubs', adminOnly, createHub);
router.put('/hubs/:id', adminOnly, updateHub);
router.post('/swap-stations', adminOnly, createSwapStation);

/* -------- KYC review -------- */
router.get('/kyc/submissions', getKycSubmissions);
router.get('/kyc/pending', listPendingKyc);
router.get('/kyc/all', listAllKyc);
router.get('/kyc/:id', getKycById);
router.post('/kyc/review/:id', reviewKyc);
router.post('/kyc/review', reviewKycByUserId);

/* -------- Bookings & rentals -------- */
router.get('/bookings', listBookings);
router.get('/bookings/:id', getBookingDetail);
router.post('/bookings/:id/confirm', confirmBooking);
router.post('/bookings/:id/cancel', cancelBooking);
router.post('/bookings/:id/handover', handoverBike);
router.get('/rentals', listRentals);
router.post('/rentals/:id/return', returnRental);
router.post('/rentals/:id/close', closeRental);
router.post('/rentals/:id/damage', logDamage);

/* -------- Weekly billing & payments -------- */
router.get('/invoices', listInvoices);
router.post('/invoices/:id/mark-paid', markInvoicePaid);
router.post('/invoices/:id/remind', sendInvoiceReminder);
router.get('/payments', listPayments);
router.post('/payments', recordManualPayment);
router.post('/payments/:id/refund', adminOnly, refundPayment);

/* -------- Damage -------- */
router.get('/damage', listDamage);
router.post('/damage/:id/resolve', resolveDamage);

/* -------- Recovery (roadside / police) -------- */
router.get('/recovery', listRecovery);
router.post('/recovery', createRecovery);
router.post('/recovery/:id/update', updateRecovery);

export default router;
