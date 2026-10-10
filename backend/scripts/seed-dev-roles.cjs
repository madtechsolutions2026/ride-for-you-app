// Local-only test accounts. No deletion/reset of existing business data.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const dotenv = require('dotenv');
const backend = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backend, '.env') });

const accounts = [
  { key: 'admin', phone: '9000001001', name: 'Test Admin', loginRole: 'ADMIN', job: 'SUPER_ADMIN', hub: 'a', salary: 30000 },
  { key: 'manager_a', phone: '9000001002', name: 'Test Manager A', loginRole: 'EXECUTIVE', job: 'HUB_MANAGER', hub: 'a', salary: 24000 },
  { key: 'employee_a', phone: '9000001003', name: 'Test Employee A', loginRole: 'EXECUTIVE', job: 'STAFF', hub: 'a', salary: 18000 },
  { key: 'support', phone: '9000001004', name: 'Test Support', loginRole: 'SUPPORT', job: 'STAFF', hub: 'a', salary: 18000 },
  { key: 'technician', phone: '9000001005', name: 'Test Technician', loginRole: 'EXECUTIVE', job: 'SERVICE_PERSON', hub: 'a', salary: 21000 },
  { key: 'manager_b', phone: '9000001006', name: 'Test Manager B', loginRole: 'EXECUTIVE', job: 'HUB_MANAGER', hub: 'b', salary: 24000 },
  { key: 'employee_b', phone: '9000001007', name: 'Test Employee B', loginRole: 'EXECUTIVE', job: 'STAFF', hub: 'b', salary: 18000 },
  { key: 'rider', phone: '9000001008', name: 'Test Rider', loginRole: 'RIDER' },
];
const hubs = [
  { key: 'a', name: 'Test Hub A — Kondapur', lat: 17.462, lng: 78.356 },
  { key: 'b', name: 'Test Hub B — Hitech', lat: 17.448, lng: 78.378 },
];
function localOnly() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || process.env.NODE_ENV === 'production') {
    throw new Error('Test accounts can only be created in a local non-production database');
  }
  return url;
}
function prepareDatabase(url) {
  const backupDir = path.join(backend, 'node_modules', '.cache', 'local-database-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const dumpPath = path.join(backupDir, `before-dev-roles-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
  const windowsDump = 'C:/Program Files/PostgreSQL/17/bin/pg_dump.exe';
  const executable = process.env.PG_DUMP_PATH || (process.platform === 'win32' && fs.existsSync(windowsDump) ? windowsDump : 'pg_dump');
  const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
  execFileSync(executable, ['--host', url.hostname, '--port', url.port || '5432', '--username', decodeURIComponent(url.username), '--dbname', decodeURIComponent(url.pathname.slice(1)), '--format=custom', '--file', dumpPath, '--no-password'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  console.log('Local database backup saved:', dumpPath);
  execFileSync(process.execPath, [path.join(backend, 'node_modules/prisma/build/index.js'), 'db', 'execute', '--file', 'prisma/attendance-payroll-upgrade.sql', '--schema', 'prisma/schema.prisma'], { cwd: backend, env: process.env, stdio: 'inherit' });
  console.log('Attendance/payroll upgrade applied to the local database.');
}
const indiaDay = (now = new Date()) => new Date(+now + 330 * 60000).toISOString().slice(0, 10);
const day = value => new Date(value + 'T00:00:00Z');
function monthBefore(today, offset) {
  const d = day(today);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - offset, 1));
  return { month: start.getUTCMonth() + 1, year: start.getUTCFullYear(), key: start.toISOString().slice(0, 7), start };
}

async function seed(prisma) {
  const today = indiaDay(), draft = monthBefore(today, 1), paid = monthBefore(today, 2);
  await prisma.$transaction(async tx => {
    // Refuse phone/ID collisions instead of promoting or replacing real accounts.
    for (const a of accounts) {
      const phone = '+91' + a.phone, id = 'dev_role_' + a.key;
      const collisions = await tx.user.findMany({ where: { OR: [{ phone }, { id }] }, select: { id: true, phone: true } });
      if (collisions.some(u => u.id !== id || u.phone !== phone)) throw new Error(`Test phone ${a.phone} is already used by another account; no accounts were changed`);
      if (a.job) {
        const employee = await tx.employee.findUnique({ where: { phone } });
        if (employee && employee.id !== 'dev_employee_' + a.key) throw new Error(`Test employee phone ${a.phone} is already used; no accounts were changed`);
      }
    }
    for (const h of hubs) await tx.hub.upsert({ where: { id: 'dev_test_hub_' + h.key }, update: {}, create: { id: 'dev_test_hub_' + h.key, name: h.name, address: 'Development test hub, Hyderabad', city: 'Hyderabad', lat: h.lat, lng: h.lng, status: 'ACTIVE', openTime: '00:00', closeTime: '23:59' } });
    for (const a of accounts) {
      const id = 'dev_role_' + a.key;
      await tx.user.upsert({ where: { id }, update: {}, create: { id, phone: '+91' + a.phone, fullName: a.name, role: a.loginRole, accountStatus: 'ACTIVE', assignedHubId: a.hub ? 'dev_test_hub_' + a.hub : null, permissions: [] } });
      if (!a.job) continue;
      const employeeId = 'dev_employee_' + a.key;
      await tx.employee.upsert({ where: { id: employeeId }, update: {}, create: { id: employeeId, userId: id, phone: '+91' + a.phone, name: a.name, role: a.job, status: 'ACTIVE', hubId: 'dev_test_hub_' + a.hub, baseSalary: a.salary, joinDate: paid.start } });
      if (a.job === 'HUB_MANAGER') {
        const h = await tx.hub.findUniqueOrThrow({ where: { id: 'dev_test_hub_' + a.hub } });
        if (!h.managerId) await tx.hub.update({ where: { id: h.id }, data: { managerId: employeeId } });
      }
      const existingDraft = await tx.salary.findUnique({ where: { employeeId_month_year: { employeeId, month: draft.month, year: draft.year } } });
      let absenceDays = 0;
      // Don't repopulate attendance after this test period has been finalized.
      if (a.loginRole !== 'ADMIN' && (!existingDraft || existingDraft.status === 'PENDING')) {
        for (let index = 1; index <= 6; index++) {
          const date = day(`${draft.key}-${String(index).padStart(2, '0')}`);
          const status = a.key === 'employee_a' && [2, 4].includes(index) ? 'ABSENT' : index === 3 ? 'LEAVE' : index === 5 ? 'WEEKLY_OFF' : 'PRESENT';
          const existing = await tx.attendance.findUnique({ where: { employeeId_date: { employeeId, date } } });
          if (!existing) {
            const row = await tx.attendance.create({ data: { employeeId, date, status, note: 'Development sample attendance', confirmedById: 'dev_role_admin', confirmedAt: new Date(), checkInTime: status === 'PRESENT' ? new Date(`${draft.key}-${String(index).padStart(2, '0')}T03:30:00Z`) : null, checkOutTime: status === 'PRESENT' ? new Date(`${draft.key}-${String(index).padStart(2, '0')}T12:30:00Z`) : null } });
            await tx.attendanceAudit.create({ data: { id: crypto.randomUUID(), attendanceId: row.id, actorId: 'dev_role_admin', action: 'DEVELOPMENT_SAMPLE', after: JSON.parse(JSON.stringify(row)), reason: 'Development sample attendance' } });
          }
        }
        absenceDays = await tx.attendance.count({ where: { employeeId, status: 'ABSENT', confirmedAt: { not: null }, date: { gte: draft.start, lt: new Date(Date.UTC(draft.year, draft.month, 1)) } } });
      }
      const snapshot = { employeeName: a.name, employeeRole: a.job, hubName: hubs.find(h => h.key === a.hub).name };
      const deductions = Math.min(a.salary, Math.round(a.salary * absenceDays / 30));
      // Create-only upserts preserve attendance/payroll changes made during testing.
      await tx.salary.upsert({ where: { employeeId_month_year: { employeeId, month: draft.month, year: draft.year } }, update: {}, create: { employeeId, month: draft.month, year: draft.year, baseSalary: a.salary, absenceDays, deductions, netPaid: a.salary - deductions, status: 'PENDING', ...snapshot } });
      const salaryId = 'dev_paid_salary_' + a.key + '_' + paid.key;
      const paidOn = new Date(Date.UTC(paid.year, paid.month, 0, 12));
      await tx.salary.upsert({ where: { employeeId_month_year: { employeeId, month: paid.month, year: paid.year } }, update: {}, create: { id: salaryId, employeeId, month: paid.month, year: paid.year, baseSalary: a.salary, absenceDays: 0, deductions: 0, netPaid: a.salary, status: 'PAID', paidOn, ...snapshot } });
      await tx.expense.upsert({ where: { id: salaryId + '_expense' }, update: {}, create: { id: salaryId + '_expense', hubId: 'dev_test_hub_' + a.hub, category: 'SALARY', amount: a.salary, date: paidOn, note: `DEV TEST sample paid payroll: ${a.name} (${paid.key}); no money transferred` } });
    }
  }, { timeout: 30000 });
  console.log(JSON.stringify({ accounts: accounts.map(a => ({ phone: a.phone, name: a.name, loginRole: a.loginRole, employeeRole: a.job || null, hub: a.hub?.toUpperCase() || null })), hubs, draftPayroll: draft.key, paidPayslips: paid.key, employeeADraftNetPay: 16800, todayLeftUnmarked: today }, null, 2));
}

async function verify(prisma) {
  // In-process HTTP checks against the real local DB, with WhatsApp disabled.
  process.env.NODE_ENV = 'test';
  delete process.env.REDIS_URL;
  require('ts-node').register({ transpileOnly: true, project: path.join(backend, 'tsconfig.json') });
  const whatsapp = require('../src/utils/whatsapp.ts');
  let deliveryCalls = 0;
  whatsapp.sendWhatsAppOtp = async () => { deliveryCalls++; return true; };
  const app = require('../src/app.ts').default;
  const request = require('supertest');
  const db = require('../src/utils/prisma.ts').prisma;
  const assert = (test, message) => { if (!test) throw new Error(message); };
  const tokens = {};
  try {
    for (const a of accounts) {
      const existing = await prisma.user.findUniqueOrThrow({ where: { id: 'dev_role_' + a.key } });
      assert(existing.role === a.loginRole && existing.accountStatus === 'ACTIVE', `Test role/status changed for ${a.name}; existing records were preserved`);
      const requested = await request(app).post('/auth/otp/request').send({ phone: a.phone });
      assert(requested.status === 200, `OTP request failed for ${a.name}: ${requested.status}`);
      assert(deliveryCalls === 0, 'Development test account attempted WhatsApp delivery');
      const challengeId = requested.body.challengeId;
      let refreshToken;
      try {
        const response = await request(app).post('/auth/otp/verify').send({ challengeId, otp: '123456' });
        assert(response.status === 200, `OTP verify failed for ${a.name}: ${response.status}`);
        assert(response.body.user.role === a.loginRole, `Wrong login role for ${a.name}`);
        refreshToken = response.body.tokens.refreshToken;
        const token = response.body.tokens.accessToken;
        tokens[a.key] = token;
        const context = await request(app).get('/admin/api/employees/attendance/context').set('Authorization', 'Bearer ' + token);
        if (a.loginRole === 'RIDER') { assert(context.status === 403, 'Rider unexpectedly has dashboard access'); }
        else {
          assert(context.status === 200, `${a.name} cannot load attendance`);
          assert(context.body.data.employee.id === 'dev_employee_' + a.key, `${a.name} employee link incorrect`);
          assert(context.body.data.canPayroll === (a.loginRole === 'ADMIN'), `${a.name} payroll permission incorrect`);
          assert(context.body.data.canReview === (a.loginRole === 'ADMIN' || a.job === 'HUB_MANAGER'), `${a.name} manager permission incorrect`);
          assert(context.body.data.active === null, `${a.name} already has an open shift; not reset`);
        }
        console.log('Verified login, employee link and access:', a.name, a.phone, a.loginRole);
      } finally {
        await prisma.otpChallenge.deleteMany({ where: { id: challengeId } });
        if (refreshToken) await prisma.session.deleteMany({ where: { userId: existing.id, refreshToken } });
      }
    }
    const previous = monthBefore(indiaDay(), 1);
    for (const key of ['manager_a', 'manager_b']) {
      const hub = key === 'manager_a' ? 'a' : 'b';
      const response = await request(app).get(`/admin/api/employees/attendance?scope=team&month=${previous.month}&year=${previous.year}`).set('Authorization', 'Bearer ' + tokens[key]);
      assert(response.status === 200 && response.body.data.length > 0, `Missing history for ${key}`);
      assert(response.body.data.every(r => r.employee.hubId === 'dev_test_hub_' + hub), `Cross-hub history leak for ${key}`);
    }
    const staff = await request(app).get('/admin/api/employees/attendance?scope=team').set('Authorization', 'Bearer ' + tokens.employee_a);
    assert(staff.status === 403, 'Employee can access team history');
    const paidMonth = monthBefore(indiaDay(), 2);
    const salary = await prisma.salary.findUniqueOrThrow({ where: { employeeId_month_year: { employeeId: 'dev_employee_employee_a', month: paidMonth.month, year: paidMonth.year } } });
    const own = await request(app).get(`/admin/api/employees/salaries/${salary.id}/payslip`).set('Authorization', 'Bearer ' + tokens.employee_a);
    const other = await request(app).get(`/admin/api/employees/salaries/${salary.id}/payslip`).set('Authorization', 'Bearer ' + tokens.manager_a);
    assert(own.status === 200 && Buffer.isBuffer(own.body) && own.body.subarray(0, 5).toString() === '%PDF-', 'Own payslip failed');
    assert(other.status === 404, 'Manager can read employee salary');
    console.log('Verified manager hub isolation, employee restrictions and own payslips. Location checking is disabled.');
    console.log('No SMS/WhatsApp was sent. Today remains ready for manual clock-in testing.');
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const url = localOnly();
  if (process.argv.includes('--prepare')) prepareDatabase(url);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    if (!process.argv.includes('--verify-only')) await seed(prisma);
    if (process.argv.includes('--verify') || process.argv.includes('--verify-only')) await verify(prisma);
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error('Local test-account setup failed:', error.message); process.exitCode = 1; });
