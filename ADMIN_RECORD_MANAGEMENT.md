# Admin record management

Sign in as **Admin**, open any dashboard section, and choose **Manage records** above the page. **Operations** returns to the existing workflow. Dashboard and Reports expose all managed record types; other sections show their related records.

Management includes searchable lists, 25-row pagination, details, create/edit forms, searchable relationship choices, validation messages, and a confirmation with a reason for removal. Only the Admin role can use the new UI and API endpoints; granting an Executive or Support user extra screens does not grant record-management access.

## Coverage

| Records | Create | Edit | Removal |
| --- | --- | --- | --- |
| Riders | New rider account | Profile/contact/status | Suspend, preserving history |
| Staff access | Provision/promote staff through staff workflow | Name/email/access role/hub | Revoke staff access; self/last-admin guards retained |
| Hubs / swap stations | Add location | Location/contact/hours/status | Delete only when no linked records exist |
| Vehicle models / rental plans | Add model/plan | Catalogue details and pricing | Delete only when unused; deactivate used catalogue entries |
| Physical vehicles | Add registered vehicle | Registration/model/hub/battery/odometer/status | Delete only when unused; reserved/rented bikes are protected |
| Bookings | Create for an approved rider using the existing reservation workflow | Nominee and planned start | Cancel through the existing workflow, releasing its reservation |
| Rentals | Hand over a confirmed booking with approved KYC and a matching bike/model/hub | Expected return while active | Record physical return; settlement/closure remains in Operations |
| Rider requests | Request an extension or return slot for a rider | Note while pending | Cancel a pending request |
| KYC | Submit rider details using the existing submission workflow | Applicant details while under review | Reject with reason; reviewed submissions remain preserved |
| Expenses | Add expense | Amount/category/date/hub/note | Delete unused expense |
| Payments | Record positive cash/manual-UPI payment | Note | Record offline refund; provider payments must use provider refunds |
| Weekly invoices | Add a period to an active rental | Unsettled amount/dates with period-continuity checks | Waive an unsettled invoice |
| Technicians | Add technician | Contact/specialization/hub/status | Delete only when no tickets refer to it |
| Service tickets | Open ticket for a released vehicle | Issue/technician/schedule while open | Cancel ticket |
| Service parts / notes | Add to an open ticket | Part/quantity/cost or note | Delete from open ticket; part totals are recalculated |
| Damage reports | Add to open rental | Description/severity/estimate while pending | Waive pending charge |
| Recovery / collections | Open recovery job | Description/priority/location/assignment/police details | Close through recovery workflow; confirm vehicle recovery because rental/bike states also change |
| Support tickets | Open ticket for rider | Category/subject/description/internal notes | Close and preserve its conversation |
| Employees | Provision linked employee account | Profile/role/hub/salary/status | Deactivate employee |
| Attendance | Add confirmed attendance with reason | Correct day/status/clock times with existing audit and payroll rules | Mark absent with reason, retaining correction history |
| Payroll drafts | Generate monthly drafts through payroll calculation | Bonuses/deductions, recalculating net pay | Delete unpaid draft; paid payroll stays locked |

Wallet transactions, battery swaps and deployment history remain immutable in this manager. Their original operational actions create entries; wallet balances cannot be overwritten independently of the ledger. Report totals and integration-status displays are derived rather than standalone editable records. Existing KYC document review/upload and support message threads remain in Operations.

No database schema change is required. Startup/deployment risks and authentication/payment issues identified in READINESS_REVIEW.md are separate from this change and are still outstanding.

## Implementation and verification

The explicit backend allowlist is `backend/src/services/adminRecords.ts`; handlers live in `backend/src/controllers/records.controller.ts`. Routes under `/admin/api/records` require Admin server-side. Relationship-aware deletion checks also protect relations declared with CASCADE or SET NULL. Direct writes run in serializable transactions, and affected caches are invalidated.

Run the focused backend checks without a database:

```powershell
cd backend
npm run test:records
npx tsc --noEmit
```

Run admin checks:

```powershell
cd admin
npm test
npx tsc --noEmit
npm run build
```

Focused backend tests use mocked persistence and real HTTP routing/role guards. UI tests exercise create, details, edit, removal confirmation, failure display, section filtering and immutable-history controls. These do not replace real PostgreSQL acceptance. The configured test database on localhost:5433 was unreachable in the earlier readiness check, so full database-backed testing remains pending.
