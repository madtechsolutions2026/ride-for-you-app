import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { absencePay, dayKey, indiaDay, period } from '../services/attendancePolicy';
import { buildPayslipPdf } from '../services/payslipPdf';

class Problem extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new Problem(status, message); };
type Tx = Prisma.TransactionClient;

function endpoint(fn: (req: AuthRequest, res: Response) => Promise<any>) {
  return async (req: AuthRequest, res: Response) => {
    try { return await fn(req, res); }
    catch (e: any) {
      if (e instanceof Problem) return res.status(e.status).json({ error: e.message });
      if (e.code === 'P2002' || e.code === 'P2034') return res.status(409).json({ error: 'Record changed. Refresh and try again' });
      console.error('Attendance/payroll:', e);
      return res.status(500).json({ error: 'Unable to complete attendance or payroll action' });
    }
  };
}
function parse<T>(fn: () => T): T { try { return fn(); } catch (e: any) { return fail(400, e.message); } }
async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 }); }
    catch (e: any) { if (e.code !== 'P2034' || i >= 2) throw e; }
  }
}
async function identity(req: AuthRequest, tx: Tx = prisma) {
  const user = await tx.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return fail(403, 'Account not found');
  // Legacy employees used local ten-digit phones. New records have a stable user link.
  const phones = [user.phone, user.phone.startsWith('+91') ? user.phone.slice(3) : user.phone];
  const matches = await tx.employee.findMany({ where: { OR: [{ userId: user.id }, { userId: null, phone: { in: phones } }] }, include: { hub: true } });
  const employee = matches.find(e => e.userId === user.id) || (matches.length === 1 ? matches[0] : null);
  const hubs = employee?.status === 'ACTIVE' ? await tx.hub.findMany({ where: { OR: [{ managerId: employee.id }, ...(employee.role === 'HUB_MANAGER' && employee.hubId ? [{ id: employee.hubId }] : [])] }, select: { id: true } }) : [];
  return { user, employee, hubIds: hubs.map(h => h.id), admin: user.role === 'ADMIN', attendanceExempt: user.role === 'ADMIN' || employee?.role === 'SUPER_ADMIN' };
}
function ownEmployee(ctx: Awaited<ReturnType<typeof identity>>) {
  if (ctx.attendanceExempt) return fail(403, 'Super Admin does not need to clock in or out');
  if (!ctx.employee || ctx.employee.status !== 'ACTIVE') return fail(403, 'Ask an administrator to link your active employee record and assign a hub');
  return ctx.employee;
}
async function employeeExempt(tx: Tx, employee: { role: string; userId: string | null; phone: string; user?: { role: string } | null }) {
  if (employee.role === 'SUPER_ADMIN') return true;
  if (employee.user) return employee.user.role === 'ADMIN';
  const normalized = /^\d{10}$/.test(employee.phone) ? '+91' + employee.phone : employee.phone;
  const account = employee.userId
    ? await tx.user.findUnique({ where: { id: employee.userId }, select: { role: true } })
    : await tx.user.findFirst({ where: { phone: { in: [employee.phone, normalized] } }, select: { role: true } });
  return account?.role === 'ADMIN';
}
function canReview(ctx: Awaited<ReturnType<typeof identity>>, employee: { id: string; hubId: string | null }) {
  return ctx.admin || (ctx.employee?.id !== employee.id && !!employee.hubId && ctx.hubIds.includes(employee.hubId));
}
async function mutableMonth(tx: Tx, employeeId: string, date: Date) {
  const key = { employeeId, month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
  if (await tx.salary.findFirst({ where: { ...key, status: 'PAID' } })) fail(409, 'This payroll period is paid and locked');
  // An attendance edit invalidates the existing draft, preventing stale payouts.
  await tx.salary.deleteMany({ where: { ...key, status: 'PENDING' } });
}
const snapshot = (row: any) => JSON.parse(JSON.stringify(row));
async function audit(tx: Tx, req: AuthRequest, before: any, after: any, action: string, reason: string) {
  await tx.attendanceAudit.create({ data: { attendanceId: after.id, actorId: req.user!.id, action, before: before ? snapshot(before) : Prisma.JsonNull, after: snapshot(after), reason } });
}
function selectedPeriod(req: AuthRequest) {
  const today = indiaDay();
  return parse(() => period(req.query.month ?? Number(today.slice(5, 7)), req.query.year ?? Number(today.slice(0, 4))));
}

export const attendanceContext = endpoint(async (req, res) => {
  const ctx = await identity(req);
  const employees = ctx.admin || ctx.hubIds.length ? await prisma.employee.findMany({
    where: ctx.admin ? {} : { hubId: { in: ctx.hubIds } },
    select: { id: true, name: true, role: true, hubId: true, status: true, phone: true, userId: true, user: { select: { role: true } }, hub: { select: { name: true } } }, orderBy: { name: 'asc' },
  }) : [];
  const reviewable = [];
  for (const employee of employees) if (!await employeeExempt(prisma, employee)) reviewable.push({ id: employee.id, name: employee.name, role: employee.role, hubId: employee.hubId, status: employee.status, hub: employee.hub });
  const active = ctx.employee && !ctx.attendanceExempt ? await prisma.attendance.findFirst({ where: { employeeId: ctx.employee.id, checkInTime: { not: null }, checkOutTime: null }, orderBy: { date: 'desc' } }) : null;
  res.json({ data: { employee: ctx.employee ? { id: ctx.employee.id, name: ctx.employee.name, status: ctx.employee.status, hub: ctx.employee.hub ? { name: ctx.employee.hub.name } : null } : null, employees: reviewable, active, attendanceExempt: ctx.attendanceExempt, canReview: ctx.admin || ctx.hubIds.length > 0, canPayroll: ctx.admin, today: indiaDay() } });
});

export const clockIn = endpoint(async (req, res) => {
  const record = await transaction(async tx => {
    const employee = ownEmployee(await identity(req, tx));
    if (!employee.hub || employee.hub.status !== 'ACTIVE') fail(400, 'An active assigned hub is required');
    const now = new Date(), date = dayKey(indiaDay(now));
    if (date < dayKey(indiaDay(employee.joinDate))) fail(400, 'Employment has not started');
    if (await tx.attendance.findFirst({ where: { employeeId: employee.id, checkInTime: { not: null }, checkOutTime: null } })) fail(409, 'You already have an open shift. Clock out or ask for a correction');
    if (await tx.attendance.findUnique({ where: { employeeId_date: { employeeId: employee.id, date } } })) fail(409, 'Attendance already exists for today. Ask your manager to correct it');
    await mutableMonth(tx, employee.id, date);
    const row = await tx.attendance.create({ data: { employeeId: employee.id, date, checkInTime: now, status: 'PRESENT', checkInHubId: employee.hubId } });
    await audit(tx, req, null, row, 'CLOCK_IN', 'Employee clock-in; location checking disabled');
    return row;
  });
  res.status(201).json({ data: record });
});

export const clockOut = endpoint(async (req, res) => {
  const record = await transaction(async tx => {
    const employee = ownEmployee(await identity(req, tx));
    const before = await tx.attendance.findFirst({ where: { employeeId: employee.id, checkInTime: { not: null }, checkOutTime: null }, orderBy: { date: 'desc' } });
    if (!before) return fail(409, 'No open shift to clock out');
    if (Date.now() - before.checkInTime!.getTime() > 24 * 3600000) fail(409, 'This shift is over 24 hours old. Ask your manager to correct the missing clock-out');
    await mutableMonth(tx, employee.id, before.date);
    const row = await tx.attendance.update({ where: { id: before.id }, data: { checkOutTime: new Date() } });
    await audit(tx, req, before, row, 'CLOCK_OUT', 'Employee clock-out');
    return row;
  });
  res.json({ data: record });
});

export const getAttendance = endpoint(async (req, res) => {
  const ctx = await identity(req);
  const p = selectedPeriod(req);
  const date = req.query.date ? parse(() => dayKey(String(req.query.date))) : null;
  const where: Prisma.AttendanceWhereInput = { date: date || { gte: p.start, lt: p.end } };
  if (req.query.scope !== 'team') where.employeeId = ctx.attendanceExempt ? '__none__' : ctx.employee?.id ?? '__none__';
  else {
    if (!ctx.admin && !ctx.hubIds.length) fail(403, 'Team attendance requires a hub manager or administrator');
    where.employee = {
      ...(!ctx.admin ? { hubId: { in: ctx.hubIds } } : {}),
      NOT: { OR: [{ role: 'SUPER_ADMIN' }, { user: { is: { role: 'ADMIN' } } }] },
    };
    if (req.query.employeeId) where.employeeId = String(req.query.employeeId);
  }
  const rows = await prisma.attendance.findMany({ where, include: { employee: { select: { id: true, name: true, role: true, hubId: true } }, audit: { orderBy: { createdAt: 'desc' } } }, orderBy: [{ date: 'desc' }, { employee: { name: 'asc' } }] });
  res.json({ data: rows });
});

export const markAttendance = endpoint(async (req, res) => {
  const { employeeId, status, note } = req.body;
  const date = parse(() => dayKey(String(req.body.date)));
  if (date > dayKey(indiaDay())) fail(400, 'Future attendance cannot be confirmed');
  if (!['PRESENT', 'ABSENT', 'LEAVE', 'WEEKLY_OFF', 'HOLIDAY'].includes(status)) fail(400, 'Choose a valid attendance status');
  if (typeof note !== 'string' || !note.trim() || note.length > 1000) fail(400, 'A correction or absence reason is required (up to 1,000 characters)');
  const result = await transaction(async tx => {
    const ctx = await identity(req, tx);
    const employee = await tx.employee.findUnique({ where: { id: String(employeeId) } });
    if (!employee) return fail(404, 'Employee not found');
    if (!canReview(ctx, employee)) fail(403, 'You cannot change attendance for this employee');
    if (await employeeExempt(tx, employee)) fail(400, 'Super Admin is exempt from attendance');
    if (date < dayKey(indiaDay(employee.joinDate))) fail(400, 'Attendance cannot precede the joining date');
    const before = await tx.attendance.findUnique({ where: { employeeId_date: { employeeId: employee.id, date } } });
    let checkInTime = before?.checkInTime ?? null, checkOutTime = before?.checkOutTime ?? null;
    if (status === 'PRESENT') {
      for (const key of ['checkInTime', 'checkOutTime'] as const) {
        if (req.body[key] !== undefined) {
          const value = req.body[key] ? new Date(req.body[key]) : null;
          if (value && (!Number.isFinite(value.getTime()) || value > new Date())) fail(400, 'Clock times must be valid and not in the future');
          if (key === 'checkInTime') checkInTime = value; else checkOutTime = value;
        }
      }
      if (checkInTime && indiaDay(checkInTime) !== req.body.date) fail(400, 'Clock-in must fall on the selected India calendar date');
      if (checkOutTime && (!checkInTime || checkOutTime <= checkInTime || +checkOutTime - +checkInTime > 24 * 3600000)) fail(400, 'Clock-out must follow clock-in within 24 hours');
      if (checkInTime && !checkOutTime && await tx.attendance.findFirst({ where: { employeeId: employee.id, id: { not: before?.id ?? '' }, checkInTime: { not: null }, checkOutTime: null } })) fail(409, 'Employee already has another open shift');
    } else { checkInTime = null; checkOutTime = null; }
    await mutableMonth(tx, employee.id, date);
    const data = { status, note: note.trim(), checkInTime, checkOutTime, confirmedById: req.user!.id, confirmedAt: new Date() };
    const row = await tx.attendance.upsert({ where: { employeeId_date: { employeeId: employee.id, date } }, create: { employeeId: employee.id, date, ...data }, update: data });
    await audit(tx, req, before, row, 'CORRECTION', note.trim());
    return row;
  });
  res.json({ data: result });
});

export const listSalaries = endpoint(async (req, res) => {
  const ctx = await identity(req), p = selectedPeriod(req);
  const rows = await prisma.salary.findMany({ where: { month: p.month, year: p.year, ...(ctx.admin ? {} : { employeeId: ctx.employee?.id ?? '__none__' }) }, include: { employee: { select: { name: true, phone: true, role: true } } }, orderBy: { employee: { name: 'asc' } } });
  res.json({ data: rows });
});

export const generateSalaries = endpoint(async (req, res) => {
  const p = parse(() => period(req.body.month, req.body.year));
  if (p.start > dayKey(indiaDay())) fail(400, 'Cannot generate future payroll');
  const count = await transaction(async tx => {
    const employees = await tx.employee.findMany({ where: { status: 'ACTIVE', joinDate: { lt: p.end } }, include: { hub: true, user: { select: { role: true } } } });
    let count = 0;
    for (const emp of employees) {
      const existing = await tx.salary.findUnique({ where: { employeeId_month_year: { employeeId: emp.id, month: p.month, year: p.year } } });
      if (existing?.status === 'PAID') continue;
      if (!emp.baseSalary) fail(400, `Set a monthly salary for ${emp.name} before generating payroll`);
      const absenceDays = await employeeExempt(tx, emp) ? 0 : await tx.attendance.count({ where: { employeeId: emp.id, date: { gte: p.start, lt: p.end }, status: 'ABSENT', confirmedAt: { not: null } } });
      const bonuses = existing?.bonuses ?? 0;
      const data = { baseSalary: emp.baseSalary, absenceDays, bonuses, ...absencePay(emp.baseSalary, absenceDays, bonuses), employeeName: emp.name, employeeRole: emp.role, hubName: emp.hub?.name ?? 'Unassigned' };
      await tx.salary.upsert({ where: { employeeId_month_year: { employeeId: emp.id, month: p.month, year: p.year } }, create: { employeeId: emp.id, month: p.month, year: p.year, ...data }, update: data });
      count++;
    }
    return count;
  });
  res.json({ data: { count }, message: 'Draft payroll generated; paid records are unchanged' });
});

export const markSalaryPaid = endpoint(async (req, res) => {
  const row = await transaction(async tx => {
    const salary = await tx.salary.findUnique({ where: { id: req.params.id }, include: { employee: true } });
    if (!salary) return fail(404, 'Salary record not found');
    if (salary.status === 'PAID') return salary;
    if (!salary.employeeName || salary.absenceDays === null) fail(409, 'Regenerate this legacy payroll draft before finalizing');
    const p = period(salary.month, salary.year);
    if (p.end > dayKey(indiaDay())) fail(409, 'Finalize payroll after the month has ended');
    if (!await employeeExempt(tx, salary.employee) && await tx.attendance.count({ where: { employeeId: salary.employeeId, date: { gte: p.start, lt: p.end }, checkInTime: { not: null }, checkOutTime: null } })) fail(409, 'Resolve missing clock-outs before finalizing payroll');
    if (Object.keys(req.body ?? {}).length) fail(400, 'Regenerate the payroll draft to change salary figures');
    const updated = await tx.salary.update({ where: { id: salary.id }, data: { status: 'PAID', paidOn: new Date() } });
    await tx.expense.create({ data: { hubId: salary.employee.hubId, category: 'SALARY', amount: salary.netPaid, note: `Payroll ${salary.id}: ${salary.employeeName ?? salary.employee.name} (${salary.month}/${salary.year})` } });
    return updated;
  });
  res.json({ data: row });
});

export const payslip = endpoint(async (req, res) => {
  const ctx = await identity(req);
  const s = await prisma.salary.findUnique({ where: { id: req.params.id }, include: { employee: true } });
  if (!s || (!ctx.admin && s.employeeId !== ctx.employee?.id)) fail(404, 'Payslip not found');
  if (s!.status !== 'PAID') fail(409, 'Payslips are available after payroll is finalized and marked paid');
  const salary = s!;
  const pdf = await buildPayslipPdf({ ...salary, employeeName: salary.employeeName ?? salary.employee.name, employeeRole: salary.employeeRole ?? salary.employee.role, hubName: salary.hubName ?? 'Not recorded' });
  const safeId = salary.employeeId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${salary.year}-${String(salary.month).padStart(2, '0')}-${safeId}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type('application/pdf').send(pdf);
});

export const exportSalariesCsv = endpoint(async (req, res) => {
  const p = selectedPeriod(req);
  const rows = await prisma.salary.findMany({ where: { month: p.month, year: p.year }, include: { employee: true } });
  const cell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = [['Employee', 'Month', 'Year', 'Monthly salary', 'Absence days', 'Deductions', 'Bonuses', 'Net pay', 'Status'], ...rows.map(s => [s.employeeName ?? s.employee.name, s.month, s.year, s.baseSalary, s.absenceDays, s.deductions, s.bonuses, s.netPaid, s.status])].map(row => row.map(cell).join(',')).join('\r\n');
  res.setHeader('Content-Disposition', `attachment; filename="payroll-${p.year}-${p.month}.csv"`);
  res.type('csv').send(csv);
});
