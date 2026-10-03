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
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  getHierarchy,
  listDeployments,
  getAttendance,
  markAttendance,
  listSalaries,
  generateSalaries,
  markSalaryPaid,
  exportSalariesCsv,
} from '../controllers/employee.controller';
import {
  getFinancialSummary,
  listExpenses,
  createExpense,
  deleteExpense,
} from '../controllers/finance.controller';
import {
  listServicePersons,
  createServicePerson,
  updateServicePerson,
  listServiceTickets,
  getServiceTicket,
  createServiceTicket,
  addServicePart,
  addServiceNote,
  updateServiceTicket,
} from '../controllers/service.controller';
import {
  listAllTickets,
  getAdminTicketDetail,
  updateAdminTicket,
  listAdminTicketMessages,
  postAgentMessage,
} from '../controllers/support.controller';
import {
  adminListRentalRequests,
  adminDecideRentalRequest,
  adminListSwaps,
} from '../controllers/ride.controller';
import {
  adminListWallets,
  adminGetWallet,
  adminCreditWallet,
} from '../controllers/wallet.controller';
import { getMrrReport, getIntegrationStatus } from '../controllers/reports.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Staff roles
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

/* -------- Legacy Staff -------- */
router.get('/staff', adminOnly, listStaff);
router.post('/staff', adminOnly, createStaff);
router.put('/staff/:id', adminOnly, updateStaff);
router.delete('/staff/:id', adminOnly, revokeStaff);

/* -------- Employees, Attendance, Hierarchy & Salaries -------- */
router.get('/employees', listEmployees);
router.post('/employees', adminOnly, createEmployee);
router.put('/employees/:id', adminOnly, updateEmployee);
router.get('/employees/hierarchy', getHierarchy);
router.get('/employees/deployments', listDeployments);
router.get('/employees/attendance', getAttendance);
router.post('/employees/attendance', markAttendance);
router.get('/employees/salaries', listSalaries);
router.post('/employees/salaries/generate', adminOnly, generateSalaries);
router.post('/employees/salaries/:id/pay', adminOnly, markSalaryPaid);
router.get('/employees/salaries/export', exportSalariesCsv);

/* -------- Finance & Expenses -------- */
router.get('/finance/summary', getFinancialSummary);
router.get('/finance/expenses', listExpenses);
router.post('/finance/expenses', createExpense);
router.delete('/finance/expenses/:id', adminOnly, deleteExpense);

/* -------- Service & Maintenance -------- */
router.get('/service/technicians', listServicePersons);
router.post('/service/technicians', createServicePerson);
router.put('/service/technicians/:id', updateServicePerson);
router.get('/service/tickets', listServiceTickets);
router.get('/service/tickets/:id', getServiceTicket);
router.post('/service/tickets', createServiceTicket);
router.put('/service/tickets/:id', updateServiceTicket);
router.post('/service/tickets/:id/parts', addServicePart);
router.post('/service/tickets/:id/notes', addServiceNote);

/* -------- Rider Support Tickets / Helpdesk -------- */
router.get('/support/tickets', listAllTickets);
router.get('/support/tickets/:id', getAdminTicketDetail);
router.put('/support/tickets/:id', updateAdminTicket);
router.get('/support/tickets/:id/messages', listAdminTicketMessages);
router.post('/support/tickets/:id/messages', postAgentMessage);

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

/* -------- Rider wallet credit (company-issued only) -------- */
router.get('/wallet', adminListWallets);
router.get('/wallet/:userId', adminGetWallet);
router.post('/wallet/:userId/credit', adminOnly, adminCreditWallet);

/* -------- Rider requests: extensions & return slots -------- */
router.get('/rental-requests', adminListRentalRequests);
router.post('/rental-requests/:id/decide', adminDecideRentalRequest);

/* -------- Battery swaps -------- */
router.get('/swaps', adminListSwaps);

/* -------- Reports & system health -------- */
router.get('/reports/mrr', getMrrReport);
router.get('/settings/integrations', getIntegrationStatus);

/* -------- Recovery (roadside / police) -------- */
router.get('/recovery', listRecovery);
router.post('/recovery', createRecovery);
router.post('/recovery/:id/update', updateRecovery);

export default router;
