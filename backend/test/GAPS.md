# Open backend gaps — surfaced by the API test suite

Each item has a test written as `it.failing(...)` that **passes while the gap
exists** and flips to **failing** once the gap is fixed. When you fix one:
1. make the behaviour correct in the controller/middleware,
2. change `it.failing` → `it` in the referenced test,
3. tick the box here.

Discovered: 2026-09-02.

Progress: **2 / 11 fixed.**

---

## Auth / access control

- [x] **GAP-1 · ROL-007 — suspended staff keep dashboard access** — FIXED 2026-09-03
  `src/middleware/auth.ts` — `authenticateToken` now loads the account (cached
  60s under `auth:me:<id>`), returns **403 "Account suspended"** for any
  non-ACTIVE status, and sources `role` from the DB so a role change / revoke is
  effective on the next request. Tests: `rbac.test.ts` ROL-006, ROL-007,
  ROL-007b.
  (Refresh + OTP-login paths for suspended accounts closed in GAP-2.)

- [x] **GAP-2 · EMP-010 — suspended accounts can still log in** — FIXED 2026-09-03
  `src/controllers/auth.controller.ts` — `verifyOtp` now returns **403
  "suspended"** after the OTP check and mints no session; `refreshToken` returns
  403 and revokes the session on the attempt. Tests: `employees.test.ts`
  EMP-010, `auth.test.ts` LOG-005c.

- [ ] **GAP-3 · VEH-001 / VEH-007 — bookings not scoped to an Executive's hub**
  `src/controllers/ops.controller.ts` — `listBookings`, `getBookingDetail`,
  `handoverBike` ignore `req.user.assignedHubId`; any EXECUTIVE sees/acts on any
  hub's bookings.
  Test: `test/api/handover.test.ts` "VEH-001/007".
  Severity: **medium**.

## KYC / handover integrity

- [ ] **GAP-4 · KYC-012 — KYC can be approved with no documents**
  `src/controllers/kyc.controller.ts` — `reviewKyc` does not verify that the
  mandatory document keys (aadhaar/pan/selfie/…) are present before APPROVE.
  Test: `test/api/kyc.test.ts` "KYC-012".
  Severity: **medium**.

- [ ] **GAP-5 · VEH-008 — handover allowed for unapproved KYC**
  `src/controllers/ops.controller.ts` — `handoverBike` never checks
  `booking.user.kycStatus === 'APPROVED'`.
  Test: `test/api/handover.test.ts` "VEH-008".
  Severity: **high**.

## Fleet / damage state machine

- [ ] **GAP-6 · STA-010 — bikes can be assigned to an INACTIVE hub**
  `src/controllers/admin.controller.ts` — `createBike` / `updateBike` accept any
  `hubId` without checking `hub.status`.
  Test: `test/api/infrastructure.test.ts` "STA-010".
  Severity: **low**.

- [ ] **GAP-7 · DAM-009 — damage loggable against a closed rental**
  `src/controllers/ops.controller.ts` — `logDamage` does not check
  `rental.status`; reports can be filed on a COMPLETED rental (post-closure
  charges).
  Test: `test/api/damage.test.ts` "DAM-009".
  Severity: **medium**.

## Input validation

- [ ] **GAP-8 · PAY-010 — no dedup on manual payments**
  `src/controllers/ops.controller.ts` — `recordManualPayment` has no
  idempotency key / duplicate guard; the same payment can be posted twice.
  Test: `test/api/payments.test.ts` "PAY-010".
  Severity: **medium**.

- [ ] **GAP-9 · DAT-006 — negative payment amount accepted**
  `src/controllers/ops.controller.ts` — `recordManualPayment` accepts any
  number, including negatives.
  Test: `test/api/validation.test.ts` "DAT-006".
  Severity: **medium**.

- [ ] **GAP-10 · DAT-003 — staff email not format-validated**
  `src/controllers/staff.controller.ts` — `createStaff` / `updateStaff` store
  any string as `email` (only lower-cased/trimmed).
  Test: `test/api/validation.test.ts` "DAT-003".
  Severity: **low**.

- [ ] **GAP-11 · DAT-010 — KYC upload accepts any file type**
  `src/controllers/kyc.controller.ts` — `ALLOWED_MIME[file.mimetype]` falls back
  to `'png'` instead of rejecting; a `.txt`/`.exe` upload is accepted.
  Test: `test/api/validation.test.ts` "DAT-010".
  Severity: **medium**.

---

### Quick run

```bash
cd backend
npx jest -t "ROL-007"          # one gap
npx jest test/api/validation   # the validation gaps
```
