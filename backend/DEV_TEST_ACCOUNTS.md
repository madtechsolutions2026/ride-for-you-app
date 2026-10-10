# Local development test accounts

These accounts were created in the local `rideforyou` database, not production.
Sign in on the local dashboard: request an OTP, then enter **123456**. The backend
must run with NODE_ENV other than `production` (`npm run dev`). Development
accounts whose IDs start with `dev_role_` skip WhatsApp delivery. Production
does not enable this exemption or the development master OTP for these accounts.

| Phone | Account | Dashboard login role | Employee job role | Hub |
|---|---|---|---|---|
| 9000001001 | Test Admin | ADMIN | SUPER_ADMIN | A |
| 9000001002 | Test Manager A | EXECUTIVE | HUB_MANAGER | A |
| 9000001003 | Test Employee A | EXECUTIVE | STAFF | A |
| 9000001004 | Test Support | SUPPORT | STAFF | A |
| 9000001005 | Test Technician | EXECUTIVE | SERVICE_PERSON | A |
| 9000001006 | Test Manager B | EXECUTIVE | HUB_MANAGER | B |
| 9000001007 | Test Employee B | EXECUTIVE | STAFF | B |
| 9000001008 | Test Rider | RIDER — mobile only; dashboard rejects login | — | — |

Use separate browser profiles or log out between accounts. Refresh the page after
logging out to avoid viewing data left on screen from the previous account.
Employee job titles are separate from dashboard login roles. Managers get hub
attendance access through their employee role/assignment; they do not get other
employees' salary access. Admin can manage all attendance and payroll.
Super Admin is exempt from their own attendance and opens on the team's records.
Their monthly salary has no attendance deductions. The attendance table has no
History column; employees' clock-ins and clock-outs still save automatically.

## Hub assignments

| Hub | Latitude | Longitude |
|---|---|---|
| Test Hub A — Kondapur | 17.462 | 78.356 |
| Test Hub B — Hitech | 17.448 | 78.378 |

Location checking is disabled for now. You do not need Chrome Sensors or browser
location permission: log in and click **Clock in**, then **Clock out**. The hub
coordinates above are retained for later location testing. Hub assignments still
scope managers' attendance access. Today was left unmarked at setup so the
initial successful clock-in can be tested manually.

## Sample attendance/payroll

The setup creates six attendance records in the previous calendar month for each
staff account, including present days, paid leave and a weekly off. Test Employee A
has two confirmed unpaid absence days: salary INR 18,000, deduction INR 1,200,
draft net pay INR 16,800. The other employees have no unpaid absence deductions.
For the initial setup on 9 October 2026, view **September 2026** for that history
and payroll. Paid sample payslips are available for **August 2026**.

August payslips have corresponding clearly labelled DEV TEST sample salary
expenses. They represent sample data; no money was transferred. September is
left as draft payroll so Admin can test finalization and payslip generation.
An attendance correction invalidates that employee's draft; regenerate it before
payment. Batch payroll generation requires a configured salary for every active
employee, including pre-existing employee profiles. If generation reports a
missing salary, set the intended salary for that profile first.

Check manager A can review A's team but not B; staff can only see their own
attendance and payroll; manager A cannot download Employee A's payslip; Rider
cannot enter the dashboard. These checks were run against the real local DB.

## Rerunning setup

From `backend`:

```powershell
npm run seed:roles
npm run verify:roles
```

The seed uses create-only upserts for its test rows. It preserves existing
business records and changes made during testing, and refuses collisions with
unrelated phone accounts. It refuses remote database hosts and NODE_ENV=production.
Verify requests/verifies OTPs without external messages, cleans up its temporary
OTP challenges and sessions, and rejects unexpected role changes or open shifts.
It can be run again after test shifts are closed; paid payroll stays locked.

For a fresh local database needing the attendance fields:

```powershell
node scripts/seed-dev-roles.cjs --prepare --verify
```

`--prepare` first creates a pg_dump backup under the ignored
`backend/node_modules/.cache/local-database-backups/` directory, then applies the
attendance/payroll SQL upgrade. Set PG_DUMP_PATH if pg_dump is not installed on
PATH or at the default Windows PostgreSQL 17 location. Normal backend startup
and Prisma generation/build prerequisites still apply.
