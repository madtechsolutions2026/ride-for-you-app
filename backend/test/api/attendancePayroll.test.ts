import { prisma } from '../../src/utils/prisma';
import { api } from '../helpers/api';
import { actingAs, makeHub } from '../helpers/factories';
import { absencePay, dayKey, indiaDay } from '../../src/services/attendancePolicy';
import { execFileSync } from 'child_process';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

const root = '/admin/api/employees';
async function employee(role: 'ADMIN' | 'EXECUTIVE' = 'EXECUTIVE', employeeRole = 'STAFF', hub?: any) {
  const login = await actingAs(role);
  hub = hub || await makeHub();
  const row = await prisma.employee.create({ data: { name: 'Test employee', phone: login.user.phone, userId: login.user.id, hubId: hub.id, role: employeeRole, baseSalary: 20000, joinDate: new Date('2020-01-01') } });
  return { ...login, employee: row, hub };
}
function lastMonth() {
  const today = dayKey(indiaDay());
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1, date: start.toISOString().slice(0, 10) };
}

describe('Attendance and monthly payroll', () => {
  it('exempts Super Admin from clock-in, corrections and attendance-based salary deductions', async () => {
    const admin = await employee('ADMIN', 'SUPER_ADMIN'), p = lastMonth();
    const context = await api().get(root + '/attendance/context').set(admin.headers);
    expect(context.status).toBe(200);
    expect(context.body.data.attendanceExempt).toBe(true);
    expect(context.body.data.employees.map((e: any) => e.id)).not.toContain(admin.employee.id);
    for (const action of ['clock-in', 'clock-out']) expect((await api().post(root + '/attendance/' + action).set(admin.headers).send({})).status).toBe(403);
    expect((await api().post(root + '/attendance').set(admin.headers).send({ employeeId: admin.employee.id, date: p.date, status: 'ABSENT', note: 'Admin absence' })).status).toBe(400);
    await prisma.attendance.create({ data: { employeeId: admin.employee.id, date: dayKey(p.date), status: 'ABSENT', confirmedAt: new Date() } });
    await prisma.attendance.create({ data: { employeeId: admin.employee.id, date: dayKey(p.date.slice(0, 8) + '02'), status: 'PRESENT', checkInTime: new Date(p.date.slice(0, 8) + '02T04:00:00Z') } });
    const team = await api().get(`${root}/attendance?scope=team&month=${p.month}&year=${p.year}`).set(admin.headers);
    expect(team.status).toBe(200);
    expect(team.body.data).toEqual([]);
    expect((await api().post(root + '/salaries/generate').set(admin.headers).send(p)).status).toBe(200);
    const salary = await prisma.salary.findFirstOrThrow();
    expect(salary.absenceDays).toBe(0);
    expect(salary.deductions).toBe(0);
    expect(salary.netPaid).toBe(admin.employee.baseSalary);
    expect((await api().post(root + '/salaries/' + salary.id + '/pay').set(admin.headers).send({})).status).toBe(200);
  });

  it('upgrades existing salary data without confirming legacy absences', async () => {
    const e = await employee(), p = lastMonth();
    await prisma.employee.update({ where: { id: e.employee.id }, data: { baseSalary: 0 } });
    await prisma.salary.create({ data: { employeeId: e.employee.id, month: p.month, year: p.year, baseSalary: 18000, netPaid: 17400, deductions: 600, status: 'PAID' } });
    await prisma.attendance.create({ data: { employeeId: e.employee.id, date: dayKey(p.date), status: 'ABSENT' } });
    const args = [path.resolve('node_modules/prisma/build/index.js'), 'db', 'execute', '--file', 'prisma/attendance-payroll-upgrade.sql', '--schema', 'prisma/schema.prisma'];
    execFileSync(process.execPath, args, { env: process.env, stdio: 'pipe' });
    execFileSync(process.execPath, args, { env: process.env, stdio: 'pipe' });
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: e.employee.id } })).baseSalary).toBe(18000);
    const salary = await prisma.salary.findFirstOrThrow();
    expect(salary.netPaid).toBe(17400);
    expect(salary.employeeName).toBe('Test employee');
    expect(salary.absenceDays).toBeNull();
    expect((await prisma.attendance.findFirstOrThrow()).confirmedAt).toBeNull();
  });

  it('creates a phone login for an employee and invalidates drafts when salary changes', async () => {
    const admin = await actingAs('ADMIN'), hub = await makeHub();
    const created = await api().post(root).set(admin.headers).send({ name: 'New employee', phone: '9876500001', hubId: hub.id, role: 'STAFF', baseSalary: 18000, joinDate: '2020-01-01' });
    expect(created.status).toBe(201);
    const e = created.body.data;
    expect(e.phone).toBe('+919876500001');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: e.userId } })).role).toBe('EXECUTIVE');
    await api().post(root + '/salaries/generate').set(admin.headers).send(lastMonth());
    expect(await prisma.salary.count()).toBe(1);
    expect((await api().put(root + '/' + e.id).set(admin.headers).send({ baseSalary: 22000 })).status).toBe(200);
    expect(await prisma.salary.count()).toBe(0);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: e.id } })).baseSalary).toBe(22000);
  });

  it('blocks finalization for an unfinished month and for an unresolved shift', async () => {
    const e = await employee(), admin = await actingAs('ADMIN');
    const today = indiaDay();
    await api().post(root + '/salaries/generate').set(admin.headers).send({ month: Number(today.slice(5, 7)), year: Number(today.slice(0, 4)) });
    const current = await prisma.salary.findFirstOrThrow();
    expect((await api().post(root + '/salaries/' + current.id + '/pay').set(admin.headers).send({})).status).toBe(409);
    expect((await api().get(root + '/salaries/' + current.id + '/payslip').set(e.headers)).status).toBe(409);
    const p = lastMonth();
    await prisma.attendance.create({ data: { employeeId: e.employee.id, date: dayKey(p.date), checkInTime: new Date(p.date + 'T04:00:00Z'), status: 'PRESENT' } });
    await api().post(root + '/salaries/generate').set(admin.headers).send(p);
    const prior = await prisma.salary.findFirstOrThrow({ where: { month: p.month, year: p.year } });
    expect((await api().post(root + '/salaries/' + prior.id + '/pay').set(admin.headers).send({})).status).toBe(409);
    expect(await prisma.expense.count()).toBe(0);
  });

  it('uses server clock times and the authenticated employee, rejects duplicate clock-in', async () => {
    const e = await employee();
    const response = await api().post(root + '/attendance/clock-in').set(e.headers).send({ employeeId: 'forged', lat: e.hub.lat, lng: e.hub.lng, accuracy: 10, checkInTime: '2000-01-01' });
    expect(response.status).toBe(201);
    expect(response.body.data.employeeId).toBe(e.employee.id);
    expect(response.body.data.date.slice(0, 10)).toBe(indiaDay());
    expect(new Date(response.body.data.checkInTime).getFullYear()).toBe(new Date().getFullYear());
    expect((await api().post(root + '/attendance/clock-in').set(e.headers).send({ lat: e.hub.lat, lng: e.hub.lng, accuracy: 10 })).status).toBe(409);
    expect((await api().post(root + '/attendance/clock-out').set(e.headers).send({})).status).toBe(200);
    expect((await api().post(root + '/attendance/clock-out').set(e.headers).send({})).status).toBe(409);
    expect(await prisma.attendanceAudit.count()).toBe(2);
  });

  it('accepts clock-in without coordinates and ignores supplied location data', async () => {
    const e = await employee();
    const response = await api().post(root + '/attendance/clock-in').set(e.headers).send({});
    expect(response.status).toBe(201);
    expect(response.body.data.checkInLat).toBeNull();
    expect(response.body.data.checkInLng).toBeNull();
    const other = await employee();
    const supplied = await api().post(root + '/attendance/clock-in').set(other.headers).send({ lat: 'invalid', lng: 0, accuracy: 500 });
    expect(supplied.status).toBe(201);
    expect(supplied.body.data.checkInLat).toBeNull();
    expect(supplied.body.data.checkInAccuracy).toBeNull();
  });

  it('permits only one concurrent clock-in', async () => {
    const e = await employee();
    const replies = await Promise.all([1, 2].map(() => api().post(root + '/attendance/clock-in').set(e.headers).send({ lat: e.hub.lat, lng: e.hub.lng, accuracy: 10 })));
    expect(replies.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.attendance.count()).toBe(1);
  });

  it('blocks employees from viewing team history or confirming their own absences', async () => {
    const e = await employee();
    expect((await api().get(root + '/attendance?scope=team').set(e.headers)).status).toBe(403);
    expect((await api().post(root + '/attendance').set(e.headers).send({ employeeId: e.employee.id, date: indiaDay(), status: 'ABSENT', note: 'Self edit' })).status).toBe(403);
    expect((await api().post(root + '/salaries/generate').set(e.headers).send(lastMonth())).status).toBe(403);
    expect((await api().get(root).set(e.headers)).status).toBe(403);
  });

  it('scopes manager history and corrections to their hub', async () => {
    const manager = await employee('EXECUTIVE', 'HUB_MANAGER');
    const sameHub = await employee('EXECUTIVE', 'STAFF', manager.hub);
    const other = await employee();
    const admin = await actingAs('ADMIN');
    for (const e of [sameHub, other]) await api().post(root + '/attendance').set(admin.headers).send({ employeeId: e.employee.id, date: indiaDay(), status: 'ABSENT', note: 'Confirmed absent' });
    const list = await api().get(root + '/attendance?scope=team').set(manager.headers);
    expect(list.status).toBe(200);
    expect(list.body.data.map((r: any) => r.employeeId)).toEqual([sameHub.employee.id]);
    expect((await api().post(root + '/attendance').set(manager.headers).send({ employeeId: other.employee.id, date: indiaDay(), status: 'PRESENT', note: 'Cross-hub edit' })).status).toBe(403);
  });

  it('records absence confirmation, counts only confirmed absences, rounds the total once', async () => {
    const e = await employee(), admin = await actingAs('ADMIN'), p = lastMonth();
    for (const day of ['01', '02']) expect((await api().post(root + '/attendance').set(admin.headers).send({ employeeId: e.employee.id, date: p.date.slice(0, 8) + day, status: 'ABSENT', note: 'Confirmed unpaid absence' })).status).toBe(200);
    await prisma.attendance.create({ data: { employeeId: e.employee.id, date: dayKey(p.date.slice(0, 8) + '03'), status: 'ABSENT' } });
    const generated = await api().post(root + '/salaries/generate').set(admin.headers).send(p);
    expect(generated.status).toBe(200);
    const salary = await prisma.salary.findFirstOrThrow();
    expect(salary.absenceDays).toBe(2);
    expect(salary.deductions).toBe(1333);
    expect(salary.netPaid).toBe(18667);
  });

  it('invalidates a draft when attendance is corrected', async () => {
    const e = await employee(), admin = await actingAs('ADMIN'), p = lastMonth();
    await api().post(root + '/salaries/generate').set(admin.headers).send(p);
    expect(await prisma.salary.count()).toBe(1);
    expect((await api().post(root + '/attendance').set(admin.headers).send({ employeeId: e.employee.id, date: p.date, status: 'LEAVE', note: 'Paid leave' })).status).toBe(200);
    expect(await prisma.salary.count()).toBe(0);
  });

  it('finalizes atomically and idempotently, then locks attendance and salary snapshots', async () => {
    const e = await employee(), admin = await actingAs('ADMIN'), p = lastMonth();
    await api().post(root + '/salaries/generate').set(admin.headers).send(p);
    const salary = await prisma.salary.findFirstOrThrow();
    const replies = await Promise.all([1, 2].map(() => api().post(root + '/salaries/' + salary.id + '/pay').set(admin.headers).send({})));
    expect(replies.map(r => r.status)).toEqual([200, 200]);
    expect(await prisma.expense.count({ where: { category: 'SALARY' } })).toBe(1);
    expect((await api().post(root + '/attendance').set(admin.headers).send({ employeeId: e.employee.id, date: p.date, status: 'ABSENT', note: 'Late correction' })).status).toBe(409);
    await prisma.employee.update({ where: { id: e.employee.id }, data: { baseSalary: 30000, name: 'Renamed' } });
    await api().post(root + '/salaries/generate').set(admin.headers).send(p);
    expect((await prisma.salary.findUniqueOrThrow({ where: { id: salary.id } })).netPaid).toBe(20000);
    const slip = await api().get(root + '/salaries/' + salary.id + '/payslip').set(e.headers);
    expect(slip.status).toBe(200);
    expect(slip.headers['content-type']).toContain('application/pdf');
    expect(slip.headers['content-disposition']).toMatch(/attachment;.*\.pdf/);
    expect(slip.headers['cache-control']).toBe('private, no-store');
    expect(slip.body.subarray(0, 5).toString()).toBe('%PDF-');
    const pdf = await PDFDocument.load(slip.body);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain('Test employee');
    expect(pdf.getTitle()).not.toContain('Renamed');
    const other = await employee();
    expect((await api().get(root + '/salaries/' + salary.id + '/payslip').set(other.headers)).status).toBe(404);
  });

  it('rejects invalid dates, future absences and missing correction reasons', async () => {
    const e = await employee(), admin = await actingAs('ADMIN');
    for (const body of [{ date: '2026-02-30', note: 'Invalid date' }, { date: '2099-01-01', note: 'Future' }, { date: indiaDay(), note: '' }]) {
      expect((await api().post(root + '/attendance').set(admin.headers).send({ employeeId: e.employee.id, status: 'ABSENT', ...body })).status).toBe(400);
    }
  });

  it('does not deduct paid days or exceed the salary, and handles India midnight', () => {
    expect(absencePay(18000, 2)).toEqual({ deductions: 1200, netPaid: 16800 });
    expect(absencePay(18000, 0)).toEqual({ deductions: 0, netPaid: 18000 });
    expect(absencePay(18000, 31)).toEqual({ deductions: 18000, netPaid: 0 });
    expect(indiaDay(new Date('2026-09-30T18:30:00Z'))).toBe('2026-10-01');
  });
});
