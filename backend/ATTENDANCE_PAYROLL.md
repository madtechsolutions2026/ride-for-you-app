# Attendance and monthly payroll

Dashboard: **Attendance & Payslips** (`/admin/attendance`). Staff sign in with
the existing phone/OTP login. Login remains available away from the hub.

## Setup and deployment

### Teammate setup after pulling this change

From `backend`, configure your own `.env` with your local `DATABASE_URL` and
the existing required application secrets. Never commit `.env` or database URLs.
Stop a running local API before installing to release the Prisma engine lock.

```powershell
npm ci
# Existing database with the previous application schema:
npm run db:upgrade:payroll
npm run prisma:generate
npm run dev
```

For a completely empty local database, use `npm run prisma:push` instead of the
upgrade command; the SQL upgrade expects the existing Employee, Attendance,
Salary, User and Hub tables. In a second terminal, from `admin`:

```powershell
npm ci
npm run dev
```

Optional development fixtures, from `backend`: `npm run seed:roles`. See
[DEV_TEST_ACCOUNTS.md](DEV_TEST_ACCOUNTS.md) for account numbers, development OTP,
sample salary months and verification. The seeder refuses production and remote
databases. Do not run seed scripts or tests against production.

### Existing production database

Use the hosting environment's production `DATABASE_URL`, apply
`npm run db:upgrade:payroll` once before deploying the new API, then build/deploy
the backend and dashboard normally. This command applies the SQL only; it does
not seed accounts or generate payroll. For Render, the service uses the database's
internal URL in the same region; a laptop uses its external URL. A P1001/P1017
connection failure must be resolved before the upgrade can complete.

The PDF/download/dialog changes require no extra SQL beyond this upgrade.
This repository currently uses an explicit SQL upgrade and Prisma schema sync;
`npm run migrate:deploy` does not apply this file.

### Upgrade details

1. Back up the database and stop the API while upgrading it.
2. Run `npx prisma db execute --file prisma/attendance-payroll-upgrade.sql --schema prisma/schema.prisma`
   from `backend`. This additive upgrade also copies each employee's most recent
   known monthly salary into the employee profile. It does not confirm old absences.
   Apply it once during rollout; repeating it is structurally safe, but zero salary
   profiles will again be filled from historical salary records.
3. Run `npx prisma generate`, then the usual build/start commands. Windows may
   require stopping the running API first because it locks the Prisma engine DLL.
   The normal `npm start` schema sync remains supported. Use the upgrade SQL first
   on existing databases to create the new unique login index without a `db push`
   unique-constraint warning stopping startup.
4. In **Employees & Payroll**, save each existing employee with their login phone,
   assigned hub, monthly salary and job role. Saving links the login; new employees
   receive an EXECUTIVE login unless that phone already has another staff role.
   Job titles do not grant the ADMIN login role.
5. Location checking is disabled for now. Clock-in requires an active employee
   and an active assigned hub, but does not request or store browser location.
   Hub assignments still determine manager access. The location helper and
   optional database fields are retained for adding location checks later.

## Rules

- Super Admin (ADMIN login or SUPER_ADMIN employee title) is exempt from personal
  clock-in/out and attendance corrections. New payroll drafts give them zero
  absence deductions; existing paid payroll is preserved. Admin opens directly
  on team attendance. The table has no History column; server audit records remain.

- Dates use Asia/Kolkata calendar days, stored as UTC midnight keys. Server time
  supplies clock times. One attendance record per employee/day; duplicate or
  overlapping open shifts are blocked, including concurrent requests.
- Employees see their own attendance and payroll. ADMIN sees all and runs payroll.
  A HUB_MANAGER reviews their assigned hub; an employee designated as a hub's
  manager can review that hub too. Managers cannot correct their own attendance
  or see other employees' payroll. ADMIN can correct any employee's attendance.
- Missing clock-outs older than 24 hours require a manager correction. A correction
  can supply clock-in/out times and requires a reason. Original and resulting
  records, actor and server time are retained in AttendanceAudit.
- Only ABSENT records with an explicit confirmation count as unpaid days. Missing
  records and legacy unconfirmed absences do not cause automatic deductions.
  LEAVE means paid leave; WEEKLY_OFF and HOLIDAY are paid. Historical HALF_DAY
  records do not automatically incur a deduction; no half-day policy was specified.
- Deduction = round(monthly salary × confirmed unpaid absence days / 30), capped
  at monthly salary. Existing accounting fields store whole rupees; round the
  total once. February and 31-day months use the same divisor. No hourly or late
  deductions, overtime, statutory deductions, or joining/leaving proration are
  added by this feature.
- Generate/refresh creates drafts for active employees whose employment has
  started by the selected month's end. A missing configured salary blocks
  generation with the employee's name. Attendance or salary changes invalidate
  affected drafts. Existing bonuses on a draft are preserved during regeneration.
- After month-end, **Finalize & mark paid** locks payroll and records one salary
  expense in the same transaction. Resolve open shifts first. Repeated/concurrent
  calls cannot duplicate the expense. This records an external payment; it does
  not transfer money. Paid payroll and its attendance period cannot be edited.
- Paid payslips download directly as an A4 PDF using **Download PDF**. Identity,
  monthly salary, absence count and amounts are snapshots. Old paid records have
  no reliable absence count and display that limitation. CSV downloads use the
  authenticated API and neutralize spreadsheet formula prefixes.

## Verification

`npm test -- --runInBand test/api/attendancePayroll.test.ts` in backend uses the
dedicated local test database configured in `.env.test`. The normal test setup
syncs and clears only that test database. `npm test` in admin runs the UI tests;
`npx tsc --noEmit` in each project checks types, and `npm run build` in admin
checks the production bundle.
