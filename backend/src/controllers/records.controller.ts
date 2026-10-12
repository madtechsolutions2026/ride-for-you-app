import crypto from 'crypto';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { delCachePrefix } from '../utils/cache';
import { RECORDS, validateRecordInput } from '../services/adminRecords';
import { createBooking } from './rental.controller';
import { createStaff, updateStaff, revokeStaff } from './staff.controller';
import { createEmployee, updateEmployee } from './employee.controller';
import { markAttendance, generateSalaries } from './attendance.controller';
import { createRentalRequest } from './ride.controller';
import { submitKyc, reviewKyc } from './kyc.controller';
import { createTicket } from './support.controller';
import { createServiceTicket, updateServiceTicket } from './service.controller';
import { GRACE_MS } from '../services/collections';
import { buildRentPaymentHandles } from '../services/upi';
import { handoverBike, cancelBooking, returnRental, recordManualPayment, refundPayment, logDamage, resolveDamage, createRecovery, updateRecovery } from './ops.controller';

class RecordError extends Error { constructor(public status: number, message: string) { super(message); } }
const reject = (message: string, status = 409): never => { throw new RecordError(status, message); };
const delegate = (db: any, model: string): any => db[model.charAt(0).toLowerCase() + model.slice(1)];
const run = (fn: (req: AuthRequest, res: Response) => Promise<any>) => async (req: AuthRequest, res: Response) => {
  try { return await fn(req, res); }
  catch (error: any) {
    if (error instanceof RecordError) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
    if (['P2002', 'P2003', 'P2034'].includes(error.code)) return res.status(409).json({ error: 'Record is linked, duplicated, or changed. Refresh and try again.' });
    console.error('Admin records:', error);
    return res.status(500).json({ error: 'Unable to save the record' });
  }
};
function specFor(req: AuthRequest) {
  const spec = Object.prototype.hasOwnProperty.call(RECORDS, req.params.entity) ? RECORDS[req.params.entity] : undefined;
  if (!spec) reject('Unknown record section', 404);
  return spec!;
}
function validated(req: AuthRequest, creating: boolean) {
  const spec = specFor(req);
  if (spec.readOnly) reject('History is preserved. Use the original operational workflow.');
  try {
    const data = validateRecordInput(spec, req.body, creating);
    const model = Prisma.dmmf.datamodel.models.find(model => model.name === spec.model)!;
    for (const [name, value] of Object.entries(data)) {
      if (value === null && model.fields.some(field => field.name === name && field.isRequired)) reject(`${name} cannot be empty`, 400);
    }
    if (data.phone) data.phone = data.phone.startsWith('+') ? data.phone : data.phone.length === 10 ? `+91${data.phone}` : `+${data.phone}`;
    return data;
  } catch (error: any) { return reject(error.message, 400); }
}
async function getRecord(req: AuthRequest, db: any = prisma) {
  const spec = specFor(req);
  const row = await delegate(db, spec.model).findFirst({ where: { ...spec.where, id: req.params.id } });
  if (!row) reject('Record not found', 404);
  return row;
}
async function references(db: any, entity: string, data: Record<string, any>) {
  for (const field of RECORDS[entity].fields) {
    if (!field.lookup || !data[field.name]) continue;
    const target = RECORDS[field.lookup];
    const record = await delegate(db, target.model).findFirst({ where: { ...target.where, id: data[field.name] } });
    if (!record) reject(`${field.label} does not exist`, 400);
    if (['hubId', 'modelId', 'assignedHubId'].includes(field.name) && record.status && record.status !== 'ACTIVE') reject(`${field.label} must be active`, 400);
  }
}
async function locked(db: any, entity: string, row: any, data: any = {}) {
  if (entity === 'bikes' && ['RENTED', 'RESERVED'].includes(row.status)) reject('Return or cancel the booking before changing this vehicle.');
  if (entity === 'bookings' && !['PENDING', 'CONFIRMED', 'READY'].includes(row.status)) reject('This booking is closed for editing.');
  if (entity === 'rentals' && !['ACTIVE', 'OVERDUE'].includes(row.status)) reject('Only active rentals can be edited.');
  if (entity === 'rentals' && data.expectedReturnAt && data.expectedReturnAt <= row.handoverAt) reject('Expected return must follow handover.', 400);
  if (entity === 'requests' && row.status !== 'PENDING') reject('Decided requests cannot be edited.');
  if (entity === 'kyc' && row.status !== 'SUBMITTED') reject('Reviewed KYC is preserved. Create a new submission.');
  if (entity === 'damage' && row.chargeStatus !== 'PENDING') reject('Resolved damage is preserved.');
  if (entity === 'service' && ['COMPLETED', 'CANCELLED'].includes(row.status)) reject('Closed service tickets are preserved.');
  if (entity === 'salaries' && row.status === 'PAID') reject('Paid payroll is locked.');
  if (entity === 'invoices') {
    if (!['PENDING', 'OVERDUE'].includes(row.status) || await db.payment.count({ where: { weeklyInvoiceId: row.id } }) || await db.walletTransaction.count({ where: { weeklyInvoiceId: row.id } })) reject('Settled or payment-linked invoices are locked.');
    const next = { ...row, ...data };
    if (next.periodStart >= next.periodEnd || next.dueAt < next.periodStart) reject('Invoice dates are inconsistent.', 400);
    if (next.weekNumber > 1) {
      const previous = await db.weeklyInvoice.findUnique({ where: { rentalId_weekNumber: { rentalId: next.rentalId, weekNumber: next.weekNumber - 1 } } });
      if (!previous || previous.periodEnd.getTime() !== next.periodStart.getTime()) reject('Invoice must follow the previous billing period.', 400);
    }
    if (await db.weeklyInvoice.count({ where: { rentalId: row.rentalId, weekNumber: { gt: row.weekNumber } } })) reject('Later billing periods exist. Preserve this invoice period.');
  }
  if (['parts', 'notes'].includes(entity)) {
    const ticket = await db.serviceTicket.findUnique({ where: { id: row.serviceTicketId } });
    if (!ticket || ['COMPLETED', 'CANCELLED'].includes(ticket.status)) reject('The service ticket is closed.');
  }
  if (entity === 'attendance') {
    if (await db.salary.count({ where: { employeeId: row.employeeId, month: row.date.getUTCMonth() + 1, year: row.date.getUTCFullYear(), status: 'PAID' } })) reject('Paid payroll period is locked.');
    if (row.checkInTime && !row.checkOutTime) reject('Clock out before deleting an active workday.');
  }
}
async function recalculateParts(db: any, ticketId: string) {
  const parts = await db.servicePart.findMany({ where: { serviceTicketId: ticketId } });
  await db.serviceTicket.update({ where: { id: ticketId }, data: { totalCost: parts.reduce((sum: number, part: any) => sum + part.cost * part.quantity, 0) } });
}
async function invalidate() {
  await Promise.all(['admin:', 'rental:', 'auth:', 'user:', 'kyc:'].map(prefix => delCachePrefix(prefix)));
}
export const recordCatalog = run(async (_req, res) => res.json({ data: RECORDS }));
export const listRecords = run(async (req, res) => {
  const spec = specFor(req);
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const search = String(req.query.search || '').trim().slice(0, 100);
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === spec.model)!;
  const searchable = ['id', 'name', 'fullName', 'phone', 'reference', 'registrationNumber', 'subject', 'description', 'partName', 'note', 'ticketNumber'].filter(name => model.fields.some(f => f.name === name));
  const where = { ...spec.where, ...(search ? { OR: searchable.map(name => ({ [name]: { contains: search, mode: 'insensitive' } })) } : {}) };
  const select = Object.fromEntries(model.fields.filter(f => f.kind !== 'object' && !['pushToken', 'rawWebhook', 'consentSignatureKey', 'attachmentKey', 'photoKeys'].includes(f.name) && !f.name.endsWith('Key')).map(f => [f.name, true]));
  const [data, total] = await Promise.all([delegate(prisma, spec.model).findMany({ where, select, orderBy: { id: 'asc' }, skip: (page - 1) * 25, take: 25 }), delegate(prisma, spec.model).count({ where })]);
  return res.json({ data, total, page, pageSize: 25 });
});
export const createRecord = run(async (req, res) => {
  const entity = req.params.entity;
  const spec = specFor(req);
  const data = validated(req, true);
  await references(prisma, entity, data);
  req.body = data;
  if (['booking', 'request', 'kyc', 'support'].includes(spec.create || '')) {
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user || user.role !== 'RIDER') reject('Select a rider', 400);
    if (spec.create === 'support' && data.bookingId && (await prisma.booking.findUnique({ where: { id: data.bookingId } }))?.userId !== data.userId) reject('Booking belongs to another rider', 400);
    req.user = { id: user!.id, role: 'RIDER' };
    delete req.body.userId;
  }
  if (spec.create === 'booking') return createBooking(req, res);
  if (spec.create === 'request') return createRentalRequest(req, res);
  if (spec.create === 'kyc') return submitKyc(req, res);
  if (spec.create === 'support') return createTicket(req, res);
  if (spec.create === 'staff') return createStaff(req, res);
  if (spec.create === 'employee') return createEmployee(req, res);
  if (spec.create === 'attendance') { req.body.date = data.date.toISOString().slice(0, 10); return markAttendance(req, res); }
  if (spec.create === 'payroll') { req.body = { month: data.month, year: data.year, bonuses: data.bonuses }; return generateSalaries(req, res); }
  if (spec.create === 'handover') {
    const booking = await prisma.booking.findUnique({ where: { id: data.bookingId }, include: { user: true } });
    const bike = await prisma.bike.findUnique({ where: { id: data.bikeId } });
    if (!booking || booking.user.kycStatus !== 'APPROVED' || !bike || bike.modelId !== booking.modelId || bike.hubId !== booking.hubId) reject('Approved KYC and a matching vehicle at the booking hub are required.', 400);
    req.params.id = data.bookingId;
    return handoverBike(req, res);
  }
  if (spec.create === 'payment') { if (data.amount <= 0) reject('Amount must be positive', 400); if (data.bookingId && (await prisma.booking.findUnique({ where: { id: data.bookingId } }))?.userId !== data.userId) reject('Booking belongs to another rider', 400); return recordManualPayment(req, res); }
  if (spec.create === 'service') { const bike = await prisma.bike.findUnique({ where: { id: data.bikeId } }); if (!bike || ['RENTED', 'RESERVED'].includes(bike.status)) reject('Return or release the vehicle before opening a service ticket.'); return createServiceTicket(req, res); }
  if (spec.create === 'damage') { const rental = await prisma.rental.findUnique({ where: { id: data.rentalId } }); if (!rental || !['ACTIVE', 'OVERDUE', 'RETURNED'].includes(rental.status)) reject('Select an open rental', 400); req.params.id = data.rentalId; return logDamage(req, res); }
  if (spec.create === 'recovery') return createRecovery(req, res);
  const row = await prisma.$transaction(async tx => {
    const db: any = tx;
    await references(db, entity, data);
    if (entity === 'riders') { data.id = `usr_${crypto.randomBytes(12).toString('hex')}`; data.role = 'RIDER'; }
    if (entity === 'invoices') { if ((await db.rental.findUnique({ where: { id: data.rentalId } }))?.status !== 'ACTIVE') reject('Select an active rental', 400); await locked(db, entity, { ...data, id: '__new__', status: 'PENDING' }); }
    if (['parts', 'notes'].includes(entity)) await locked(db, entity, data);
    const created = await delegate(db, spec.model).create({ data });
    if (entity === 'parts') await recalculateParts(db, created.serviceTicketId);
    return created;
  }, { isolationLevel: 'Serializable' });
  await invalidate();
  return res.status(201).json({ data: row });
});
export const updateRecord = run(async (req, res) => {
  const entity = req.params.entity;
  const spec = specFor(req);
  const data = validated(req, false);
  const row = await getRecord(req);
  await references(prisma, entity, data);
  if (entity === 'staff') { req.body = data; return updateStaff(req, res); }
  if (entity === 'employees') { req.body = data; return updateEmployee(req, res); }
  if (entity === 'attendance') { req.body = { ...data, employeeId: row.employeeId, date: row.date.toISOString().slice(0, 10) }; return markAttendance(req, res); }
  const saved = await prisma.$transaction(async tx => {
    const db: any = tx;
    const current = await getRecord(req, db);
    await locked(db, entity, current, data);
    await references(db, entity, data);
    if (entity === 'salaries') data.netPaid = Math.max(0, current.baseSalary + (data.bonuses ?? current.bonuses) - (data.deductions ?? current.deductions));
    if (entity === 'service' && data.assignedServicePersonId !== undefined && data.assignedServicePersonId !== current.assignedServicePersonId) data.assignedAt = new Date();
    if (entity === 'invoices') {
      const handles = await buildRentPaymentHandles({ invoiceId: current.id, amount: data.amount ?? current.amount, weekNumber: current.weekNumber });
      data.upiUri = handles.upiUri || null;
      data.paymentLinkUrl = handles.appLink;
      data.graceEndsAt = new Date((data.dueAt ?? current.dueAt).getTime() + GRACE_MS);
    }
    const updated = await delegate(db, spec.model).update({ where: { id: current.id }, data });
    if (entity === 'parts') await recalculateParts(db, current.serviceTicketId);
    return updated;
  }, { isolationLevel: 'Serializable' });
  await invalidate();
  return res.json({ data: saved });
});
export const deleteRecord = run(async (req, res) => {
  const entity = req.params.entity;
  const spec = specFor(req);
  if (spec.readOnly) reject('History is preserved. Use the original operational workflow.');
  const reason = req.body?.reason;
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000) reject('A removal reason is required', 400);
  const row = await getRecord(req);
  if (spec.remove === 'cancelBooking') { req.body = { reason }; return cancelBooking(req, res); }
  if (spec.remove === 'returnRental') { if (!['ACTIVE', 'OVERDUE'].includes(row.status)) reject('Only active rentals can be returned.'); req.body = {}; return returnRental(req, res); }
  if (spec.remove === 'revoke') return revokeStaff(req, res);
  if (spec.remove === 'rejectKyc') { req.body = { action: 'REJECT', reason }; return reviewKyc(req, res); }
  if (spec.remove === 'refundPayment') { if (!['CASH', 'UPI_MANUAL'].includes(row.provider)) reject('Provider payments must be refunded through the provider.'); req.body = { note: reason }; return refundPayment(req, res); }
  if (spec.remove === 'waiveDamage') { if (row.chargeStatus !== 'PENDING') reject('Resolved damage is preserved.'); req.body = { action: 'WAIVE' }; return resolveDamage(req, res); }
  if (spec.remove === 'cancelService') { req.body = { status: 'CANCELLED' }; return updateServiceTicket(req, res); }
  if (spec.remove === 'closeRecovery') { if (['RESOLVED', 'CLOSED'].includes(row.status)) reject('This job is already closed.'); req.body = { status: 'CLOSED', resolutionNote: reason }; return updateRecovery(req, res); }
  if (entity === 'attendance') { req.body = { employeeId: row.employeeId, date: row.date.toISOString().slice(0, 10), status: 'ABSENT', note: reason }; return markAttendance(req, res); }
  const result = await prisma.$transaction(async tx => {
    const db: any = tx;
    const current = await getRecord(req, db);
    if (['cancelRequest', 'waiveInvoice'].includes(spec.remove || '')) await locked(db, entity, current);
    const status = ({ suspend: 'SUSPENDED', deactivateEmployee: 'INACTIVE', cancelRequest: 'CANCELLED', waiveInvoice: 'WAIVED', closeRecovery: 'CLOSED', closeSupport: 'CLOSED' } as Record<string, string>)[spec.remove || ''];
    if (status) {
      if (entity === 'employees') { req.body = { status }; return null; }
      return delegate(db, spec.model).update({ where: { id: current.id }, data: entity === 'riders' ? { accountStatus: status } : entity === 'support' ? { status, adminNotes: reason, resolvedAt: new Date() } : entity === 'recovery' ? { status, resolutionNote: reason, resolvedAt: new Date() } : entity === 'requests' ? { status, decisionNote: reason, decidedById: req.user!.id, decidedAt: new Date() } : { status } });
    }
    await locked(db, entity, current);
    // Reject even CASCADE/SET NULL dependencies; deleting a catalogue row must
    // never silently erase vehicles, history, attendance or financial records.
    for (const model of Prisma.dmmf.datamodel.models) {
      for (const relation of model.fields.filter(f => f.kind === 'object' && f.type === spec.model && f.relationFromFields?.length)) {
        const where = Object.fromEntries(relation.relationFromFields!.map((field, i) => [field, current[relation.relationToFields![i]]]));
        if (await delegate(db, model.name).count({ where })) reject(`This record is used by ${model.name}. Edit or deactivate it instead.`);
      }
    }
    const deleted = await delegate(db, spec.model).delete({ where: { id: current.id } });
    if (entity === 'parts') await recalculateParts(db, current.serviceTicketId);
    return deleted;
  }, { isolationLevel: 'Serializable' });
  if (entity === 'employees') return updateEmployee(req, res);
  await invalidate();
  return res.json({ data: result, message: spec.remove ? 'Record updated; history preserved.' : 'Record deleted.' });
});
