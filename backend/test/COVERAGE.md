# Scenario coverage map

Source: `Ride_For_You_Dashboard_Testing_Scenarios.xlsx` (326 rows, 27 modules).
The **IoT Integration** module (IOT-001..012) is out of scope by request.

Legend
- **✅ covered** — an automated API test asserts the behaviour
- **⚠️ gap** — test written with `it.failing`; documents a missing check the code
  *should* have. Flips to failing when fixed → remove the `.failing` then.
- **⛔ not built** — the feature/entity does not exist in the backend yet;
  `it.skip` with a note. Nothing to test at the API layer.
- **🖥️ client-only** — front-end / browser concern, no API surface; `it.skip`.

Full run: **16 suites, 199 tests — 167 pass (incl. 11 `it.failing` gaps), 32 skip.**

| Module | File | Status |
|---|---|---|
| Login & Authentication (LOG-001..008) | `auth.test.ts` | ✅ 001–007. ⛔ 008 (no password to reset — OTP only). NOTE 007: no attempt lockout. |
| Role-Based Access (ROL-001..009) | `rbac.test.ts` | ✅ 001–006, 008. ⚠️ 007 (`authenticateToken` ignores `accountStatus`). ⛔ 009 (no audit-log table). |
| Dashboard Overview (DAS-001..012) | `dashboard.test.ts` | ✅ 001–005, 007–010, 012 + finance/overdue. ⛔ 006 (no refund-request entity). 🖥️ 011. |
| Employee Management (EMP-001..012) | `employees.test.ts` | ✅ 001–009 + revoke/self-revoke guards. ⚠️ 010 (`verifyOtp` ignores `accountStatus`). ⛔ 011/012 (no search/status params on `listStaff`). |
| Customer / Rider Management (CUS-001..012) | `riders.test.ts` | ✅ 001–006, 009–012 + block/unblock. ⛔ 007 (no bank entity), 008 (no attachment entity). |
| KYC Approval (KYC-001..016) | `kyc.test.ts` | ✅ 001–006, 010, 013–015 + review-twice + legacy path. ⚠️ 012 (approval doesn't check documents present). ⛔ 007/008 (no DL field), 009 (no face-match result), 011 (no responsibility-video field), 016 (no search param). |
| Inventory & Vehicle Management (INV-001..017) | `fleet.test.ts` | ✅ 001–007, 009–011, 017 + catalogue model/plan CRUD + model validation. ⛔ 008 (no retired status), 012 (range not in admin API), 013–016 (no server-side filter params). |
| Station Management (STA-001..011) | `infrastructure.test.ts` | ✅ 001–007 + swap-station create. ⚠️ 010 (`createBike` doesn't check `hub.status`). ⛔ 008 (rider-side logic), 009 (no capacity field), 011 (no search params). |
| Booking Management (BOO-001..014) | `bookings.test.ts` | ✅ 001–013 (status filter, detail, confirm, cancel, guards, reference search). ⛔ 013b date/station filter (not supported), 014 (dedup is rider-side). |
| Vehicle Handover (VEH-001..010) | `handover.test.ts` | ✅ 002–006, 009, 010 + bike-state guards + double-handover. ⚠️ 008 (no rider-KYC check), 001/007 (bookings + handover not hub-scoped for EXECUTIVE). |
| Active Rental & Tracking (ACT-001..011) | — | ⛔ deferred with IoT: live GPS/geofence/lock/tamper/battery telemetry has no non-IoT surface. `listRentals` overdue flag is covered in `rentals.test.ts`. |
| Damage & Penalty (DAM-001..013) | `damage.test.ts` | ✅ 001–008, 011–013 + waive + resolve-twice + invalid-action + filter. ⚠️ 009 (`logDamage` allows reports on COMPLETED rentals). ⛔ 010 (no edit endpoint). |
| Return & Rental Closure (RET-001..012) | `rentals.test.ts` | ✅ 001–006, 008, 010–012 + return-twice + overdue flag. ⛔ 007/009 (closeRental settles state only — no final-bill / deposit calc). |
| Bank Details & Refunds (BAN-001..015) | `payments.test.ts` | ✅ refunds 004, 006, 009–015 (ADMIN-only, partial amount, SUCCESS-only, no double refund, appears in history). ⛔ 001–003 (no bank-account entity), 005 (no eligible-amount endpoint). |
| Attachments & Rent Reduction (ATT-001..011) | — | ⛔ not built: no attachment / rent-reduction-rule entity or endpoints in the backend. |
| Payments & Delays (PAY-001..011) | `payments.test.ts` | ✅ 001–007, 011 + totals + manual-payment validation + double mark-paid. ⚠️ 010 (no dedup on manual payments). ⛔ 008 (no escalation), 009 (no gateway webhook endpoint). |
| Customer Support (11 rows) | — | ⛔ not built: no support-ticket entity. The closest feature is `RecoveryJob` (roadside/police), which has `listRecovery` / `createRecovery` / `updateRecovery` — not part of the spreadsheet's support-ticket flow. |
| Battery Swap & Charging Stations (BAT-001..011) | partial | ✅ swap-station create (`infrastructure.test.ts`). ⛔ 004–011 battery inventory / assignment / status: no `Battery` entity in the schema. |
| Multi-Language Content (MUL-001..011) | — | ⛔ not built: no content / translation entity or endpoints. (Booking consent stores a language code only.) |
| Reports & Analytics (REP-001..013) | — | ⛔ not built: no report-generation endpoints. `/admin/api/stats` KPIs are covered under DAS. |
| Notifications & Alerts (NOT-001..012) | — | ⛔ not built: no notification entity/endpoints. WhatsApp sends are fire-and-forget (mocked in tests). |
| Search, Filters & Sorting (SEA-001..012) | `search.test.ts` | ✅ 001–012 against `GET /admin/api/users` (keyword, digit→phone, partial, min-length, single/multi filter, clear, order, pagination, clamp, empty result). |
| Data Validation & Error Handling (DAT-001..015) | `validation.test.ts` | ✅ 001, 004, 008, 009, 011, 013 + malformed-JSON + unknown docType. ⚠️ 003 (no email-format check), 006 (negative amount accepted), 010 (unsupported file type accepted). ⛔ 002 (phone coerced, never rejected), 005 (no date-range endpoint). 🖥️ 012/014. |
| Security Testing (SEC-001..014) | `security.test.ts` | ✅ 001–005, 009–012, 014 (anon/role/expired/forged/garbage token, logout revocation, KYC-admin gate, SQLi literal, XSS stored-as-data, reviewer recorded). ⛔ 006 (OTP only), 007 (no masking layer — by design), 008 (no bank entity). 013 → see DAT-009/010. |
| Performance Testing (PER-001..010) | — | not attempted: load/latency assertions are flaky in a functional suite and need a seeded large dataset + a dedicated runner (k6 / autocannon). Out of scope for API integration tests. |
| Cross-Browser & Responsive (CRO-001..009) | — | 🖥️ browser-only: needs Playwright/BrowserStack. No API surface. |

## The 11 documented gaps (`it.failing`)

| ID | File | Missing check |
|---|---|---|
| ROL-007 | `rbac.test.ts` | `authenticateToken` never checks `user.accountStatus` — a SUSPENDED staff token still works. |
| EMP-010 | `employees.test.ts` | `verifyOtp` issues tokens to a SUSPENDED account. |
| VEH-008 | `handover.test.ts` | `handoverBike` never checks `booking.user.kycStatus`. |
| VEH-001/007 | `handover.test.ts` | `listBookings` / handover are not scoped to an EXECUTIVE's `assignedHubId`. |
| KYC-012 | `kyc.test.ts` | `reviewKyc` approves even with no document keys on the row. |
| STA-010 | `infrastructure.test.ts` | `createBike` / `updateBike` accept an INACTIVE `hubId`. |
| DAM-009 | `damage.test.ts` | `logDamage` accepts reports against a COMPLETED (closed) rental. |
| PAY-010 | `payments.test.ts` | `recordManualPayment` has no idempotency/dedup. |
| DAT-003 | `validation.test.ts` | staff `email` is not format-validated. |
| DAT-006 | `validation.test.ts` | `recordManualPayment` accepts a negative `amount`. |
| DAT-010 | `validation.test.ts` | KYC upload accepts any MIME type (`ALLOWED_MIME` falls back to `png`). |
