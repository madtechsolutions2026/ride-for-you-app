# Deployment readiness review — 12 October 2026

Verdict: **not ready for production deployment**. The admin and mobile have substantial implemented functionality, but authentication, payment integrity, database deployment and business-rule gaps prevent launch approval.

This is a review of the current local source and executable checks. No production deployment, real payment, external message, or production database mutation was performed. Application source was not changed.

## Executed checks

| Check | Result |
| --- | --- |
| Admin tests | 4 suites, 39 tests passed |
| Admin TypeScript | Passed |
| Admin production build | Passed; main JavaScript bundle approximately 619 kB, with Vite size warning |
| Mobile tests | First run: 19 passed, one notification-loading test timed out. Rerun: all 3 suites / 20 tests passed. Track this instability. |
| Mobile TypeScript | Passed |
| Android JavaScript/Hermes export | Passed, 1,224 modules bundled. This is not an APK build or physical-device test. |
| Mobile theme check | Failed: 79 raw colour literals outside the theme directory; consistency issue, not proof of a runtime failure |
| Backend locked dependency install / Prisma generation | Passed after using the working system npm and a workspace cache |
| Backend TypeScript compilation | Passed after fresh dependencies / generated Prisma client. Initial errors were caused by stale local dependencies. |
| Prisma schema validation | Passed |
| Backend API integration tests | Blocked in global setup. Configured isolated database is localhost:5433 / rideforyou_test. TCP probe returned ECONNREFUSED on 5433; 5432 is reachable. No API assertions ran. Do not redirect the destructive suite to a working business database. |
| Production dependency audit: backend | 6 findings: 5 moderate, 1 critical (proxy-addr) |
| Production dependency audit: admin | 2 moderate findings through React Router; high-threshold audit exits successfully but still reports findings |
| Production dependency audit: mobile | 48 findings: 18 moderate, 29 high, 1 critical (shell-quote). Several are tooling dependencies pulled through Expo / React Native; assess exposure individually. |

Dependency audit counts describe npm's dependency graph, not confirmed exploitable vulnerabilities in every deployed runtime. Upgrade with compatible versions and retest; some suggested force fixes introduce breaking upgrades or an Expo downgrade.

## Launch blockers, in priority order

1. **Production authentication bypass.** In `backend/src/controllers/auth.controller.ts`, the test-phone branch accepts the fixed development OTP even when NODE_ENV is production. Several listed numbers are automatically promoted to ADMIN. Remove production bypass and automatic phone-based promotion; use explicit staff provisioning. Add production-mode regression tests. The same file logs real OTPs, has no verification attempt lockout and generates codes with Math.random. Harden generation, attempts and logs. One hardcoded admin phone is excluded from WhatsApp delivery even in production.
2. **Payments can succeed without collecting money.** `payBooking` and `payWeeklyInvoice` in `backend/src/controllers/rental.controller.ts` create DUMMY successful payments without a production-mode guard. These routes are exposed, and BookingPaymentScreen calls the booking stub directly. Adding gateway credentials alone does not fix this. Route checkout through payment intents and verified provider settlement; disable stub settlement in production, including when credentials are incomplete.
3. **Database startup can destroy data.** `backend/package.json` start/prisma:push and the Dockerfile use `prisma db push --accept-data-loss`. DEPLOY.md claims the opposite. Remove automatic destructive acceptance and adopt a reviewed schema deployment procedure, backup and restore checks. There is no Prisma migration history in this checkout; do not assume migrate:deploy applies the schema.
4. **Handover lacks essential checks.** `handoverBike` does not verify approved rider KYC; booking access/handover is not scoped to an Executive's assigned hub. It also does not verify the selected bike matches the booking's model and hub. Add server checks and concurrent-assignment tests.
5. **KYC approval and file validation are incomplete.** Approval does not require mandatory documents. Unsupported upload MIME types fall back to png. Submission accepts mock_ document references. Enforce actual owned documents, valid file content/type and production-safe document references; verify R2 upload/review end to end.
6. **Finance integrity gaps.** Manual payments accept negative amounts and have no duplicate/idempotency protection. Refunds are internal ledger adjustments, not provider payouts, and refundPayment has no upper-bound check against the original amount. Rental close-out sums damage payments across the rider rather than only the current rental, risking incorrect deposit deductions. Scope settlement correctly and distinguish recorded adjustments from actual returned money.
7. **API permissions are broader than dashboard menus.** AuthContext hides screens by role/permissions, but many backend routes only require any staff role. For example, all staff roles can call service mutations and KYC review regardless of menu access. Enforce the intended permission matrix on the server, including hub scope.
8. **Credential hygiene.** `backend/src/config/way2chats.ts` contains an API-key-like fallback literal. Treat it as exposed if real, rotate it and require environment configuration. JWT_SECRET falls back to a known string; fail startup in production when absent/weak. Do not publish OTPs or credentials in logs.
9. **Scheduled jobs depend on the web process staying alive.** Billing, collections and booking expiry use in-process timers. Sleeping hosts delay them; multiple replicas can run the same jobs. Use reliable scheduling with locking/idempotency, verify restart catch-up and overlapping runs.
10. **Unfinished test acceptance.** Backend API tests must execute against an isolated database. The suite contains nine `it.failing` cases that are considered successful when a known defect remains, plus skipped cases. Convert expected-failure tests to normal assertions as fixes land. Complete browser, device and integration acceptance below.

Additional known gaps retained in source/tests: bikes can be assigned to inactive hubs; damage can be added to completed rentals; legacy staff email is not format-validated. Existing GAPS.md is useful, but COVERAGE.md is stale: support tickets, notifications, reports, gateway routes and deposit settlement now exist.

## Every admin dashboard section

“Implemented” below means code and API wiring exist. It does not mean the feature passed full live acceptance; backend integration execution was blocked.

| Section | Purpose and implemented actions | Pending / limitations |
| --- | --- | --- |
| Dashboard | Fleet/rider/KYC/revenue KPIs and work queues; shortcuts to operations sections | Reconcile totals with trusted transactions and data. Map/device displays are not verified telemetry. |
| Riders | Search/filter/paginate riders, inspect profile and rental/payment history, suspend/reactivate accounts; wallet balance/history and admin credits | Validate role boundaries and credit idempotency/concurrency. Bank-details and attachment workflows are absent. |
| Bookings & Rentals — list | Review bookings/payments, confirm/cancel, assign a bike at handover, track rentals, return and close | KYC/hub/model checks, concurrent state transitions and real payments need fixing. Confirmation can record outstanding balance as offline money; staff must understand and authorize that accounting action. |
| Bookings & Rentals — rider requests | Review and approve/reject extension and return-slot requests | Validate dates, conflicting requests, permissions and resulting billing/return schedules through a complete scenario. |
| Vehicles & Fleet | Physical units, registration/model/hub/status/battery, add/edit bikes, model catalogue and plans; map component | IoT ingestion, device identity/authentication and actual commands are not built. Commands use setTimeout to simulate success; map stats include fixed 78%, 89 swaps and 54/54 online. API substitutes jittered hub coordinates when GPS is missing. Remove or clearly label simulated displays. Check inactive-hub assignments. |
| KYC Approvals | View submitted identity/address/selfie documents; approve/reject with reason | Mandatory-document, mock-reference and upload checks; R2 access and signed-document URL expiry. Driving-licence/face-match/responsibility-video workflows are absent. |
| Hubs & Stations — hubs | List and create pickup hubs, locations and operational details; backend supports hub update | Validate coordinates/status and inactive-hub effects. Capacity management is absent. |
| Hubs & Stations — swap stations | List/create battery-swap locations | No full battery inventory/assignment/charging lifecycle. Physical swap and station availability need device/ops acceptance. |
| P&L & Expenses — summary | Collected revenue, costs and net summary | A summary is not audited accounting; validate treatment of wallet credits, deposits, refunds and stub payments. |
| P&L & Expenses — expenses | Add operating expenses, inspect ledger and admin delete | Validate amount/category/hub inputs and authorization; verify reconciliation and audit trail. |
| P&L & Expenses — weekly invoices | View invoice status, periods and outstanding balances | Reliable scheduled billing, retries, partial/wallet payments and late collections require acceptance. |
| P&L & Expenses — payments | View payment ledger and settlement totals | Manual-payment validation/dedup and real provider settlement/refunds remain blockers. |
| Service & Damage — tickets | Create maintenance tickets, track status, attach technician, add parts/costs and notes | No dedicated service-controller test suite found; verify costs, inventory assumptions and bike status transitions. |
| Service & Damage — technicians | Create/update service technicians and inspect workload | Enforce mutation permissions and test assignment/status validation. |
| Service & Damage — damage | Inspect reports; charge/waive/resolve | Closed-rental reporting and financial settlement scope need fixing. Verify evidence and charge authorization. |
| Recovery & Collections — collections | View unpaid-rent recovery jobs, outstanding invoices, assignment and progress/completion | Reliable reminder ladder and scheduling; prevent duplicate/repeated escalation. |
| Recovery & Collections — roadside & police | Create/manage breakdown, theft and police-hold jobs; dispatch details/status | Verify assignment, permissions, completion and bike/rental state. This is operational tracking, not actual automatic dispatch or IoT control. |
| Support Helpdesk | Rider ticket queues, categories/status, messages, agent replies and resolution | Verify rider/staff thread privacy, attachments if required, notification delivery and resolution lifecycle. |
| Attendance & Payslips | Clock in/out, own/team history, attendance corrections; monthly drafts, admin payroll finalization, CSV and PDF payslips | Verify linked employees/hubs, time rules, paid-period locking, deductions and PDF content with actual data. UI tests passed; API suite did not execute. |
| Employees & Payroll | Team CRUD, roles/user links, salary details, hub assignment, hierarchy and bike deployment history | Complete role provisioning/revocation tests and operational hierarchy acceptance. Payroll execution lives in Attendance & Payslips. General role-change audit logging remains incomplete. |
| Reports & MRR | Recurring-revenue estimates, trends, collection/churn analytics | Verify formulas and date boundaries. Estimated recurring revenue is distinct from collected cash. Compare with ledger exports; no full browser report test. |
| Pricing & System — pricing | Edit model rental-plan pricing, deposits and limits | Validate nonnegative prices/deposits, permissions and effect on existing versus new bookings. |
| Pricing & System — integrations | Reports whether gateway, WhatsApp, R2 and Redis environment variables exist; shows payment mode and Expo push availability | Configuration presence is not a connectivity test. Razorpay status omits webhook-secret readiness, WhatsApp fallback can differ from env status, and push is shown configured without delivery proof. |

Admin has all screens. Executive defaults cover dashboard, fleet, bookings, KYC, network, service, recovery and attendance. Support defaults cover dashboard, riders, bookings, finance, recovery, support and attendance. Extra screen grants are supported in the client; actual API enforcement must be aligned before launch.

## Acceptance still required before deployment

1. Bring up an isolated disposable PostgreSQL test database on the configured port and run all backend suites; inspect skipped and expected-failure cases individually.
2. Fix the launch blockers and add meaningful production-mode auth/payment, ownership, financial and concurrency regression checks.
3. Run the exact production build/container and schema procedure against staging. Check startup, /health, /admin/ nested routes and API responses. Docker is unavailable in this environment. Health currently reports process status without checking database/provider readiness.
4. Complete browser testing of every screen under each role, forms/errors, direct URLs, token expiry/logout, refresh, navigation, mobile viewport and major browsers. Current admin tests cover only selected navigation/components/attendance behavior.
5. Run a complete rider cycle on a real Android build: OTP, KYC camera/upload, booking, actual provider payment/webhook, handover, invoice/wallet payment, extension, support, damage, return and actual deposit refund. Android export does not verify native modules, permissions, signing or installed-app behavior. iOS was not built/tested.
6. Prove gateway invalid signatures, duplicate/reordered callbacks, failure/timeout paths and real refund outcomes in a provider sandbox, then verify production configuration. External service credentials and host configuration were not inspected or exercised.
7. Verify WhatsApp and Expo push delivery on real devices; R2 storage/access; Redis behavior if enabled; restart/catch-up and multiple-worker scheduling.
8. Resolve dependency advisories with compatible versions and repeat relevant checks. Add CI gates for backend/admin/mobile tests and builds; the current workflow primarily typechecks and publishes mobile OTA to preview.
9. Choose and document the deployment host/API URL: DEPLOY.md describes Render, whereas the mobile default points to Railway. Set EXPO_PUBLIC_API_URL explicitly for staging and production and validate installed app/OTA channel/runtime compatibility.
10. Test backup restore, data persistence across restarts, load with representative fleet/rider volume, error monitoring and production seed data. Replace stale README/DEPLOY/COVERAGE claims.

No release readiness percentage is assigned: passed unit tests cannot compensate for production authentication/payment bypasses or unexecuted backend acceptance.
