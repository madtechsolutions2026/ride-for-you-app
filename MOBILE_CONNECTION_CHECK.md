# Mobile/admin connection check — 12 October 2026

Admin URL: https://ride-for-you-app-production.up.railway.app/admin/

Current mobile source and preview/production build profiles use the same Railway API host. Admin API requests use their page's origin. Both backend route groups read the same Prisma database; hubs, fleet models/plans, bookings, rentals, KYC and rider accounts are shared, with rider ownership and active-status filtering applied to rider endpoints.

The previous latest completed APK (build 73e4ea6f-6065-4269-80cc-2f53ca3a67ac, 6 October 2026 at 04:15 IST) embedded the old Render host. The newest preview OTA listed by Expo targets runtime 1.0.0, while that APK uses 1.0.1. Therefore it cannot be assumed that the previous APK received the Railway connection change.

New APK completed successfully on **12 October 2026 at 21:34 IST**, version 1.0.1, preview profile. Download verified with HTTP 200 (118,433,908 bytes):

https://expo.dev/artifacts/eas/OX7O8qV0hTTNWPPunCTJ6DuTdwd1_TOLigaG8ElXor4.apk

Build details:

https://expo.dev/accounts/madtech2026/projects/ride-for-you-mobile/builds/5e9dcc44-61f1-485c-acc8-20e231f9e805

## Changes and checks

- Hub sheets use real API records and counts; empty/error responses no longer show sample locations. Reopening a sheet reloads its data.
- Home map starts empty and shows actual hub pins. Counts come from active hub inventory. Removed sample map pins, invented distances and station network advertising.
- Vehicle list consumes the actual `/rental/bikes?category=...` response (previously one request used the wrong response shape and another had independent hardcoded price calculations). Weekly rent/deposit now use the plan values; the booking fee follows the API's existing ₹200 contract, with explicit API fee support added in backend source. Artwork remains bundled where no model image is supplied.
- Vehicle data and booking/KYC state refresh on screen focus. Unavailable bikes cannot proceed to booking.
- Removed battery-swap entry points for the current no-station rollout; the scanner reports unavailable when the station API returns none.
- Backend source scopes inventory to active hubs and the chosen hub, and prevents inactive-hub booking requests from silently selecting a different hub.
- Admin infrastructure source shows active locations by default; inactive historical records remain accessible through Admin record management.
- Mobile TypeScript and 26 tests passed. Android JS/Hermes export passed. Admin 48 tests, TypeScript and production build passed. Backend TypeScript and 23 focused tests passed.
- Live admin session later expired: infrastructure requests returned 403 while the old UI displayed an empty station list. This was not evidence of zero live stations. The local admin source now shows a request error instead, covered by two regression tests.
- Read-only local HTTP check against PostgreSQL passed: admin and rider hub identifiers/names/coordinates match, active stations = 0, and rider rental-plan prices/deposits match admin plans. This check did not reset the database.

## Hub configuration — distinguish live from local

Bahadurpally: latitude 17.5654, longitude 78.4379, supplied by the user.

**Live Railway, verified 12 October:** Bahadurpally is the only ACTIVE hub at 17.5654, 78.4379; ACTIVE battery stations = 0. Applied reversible status changes through the authenticated Railway console and preserved existing records. The live rider APIs returned HTTP 200: `/rental/hubs` contains exactly Bahadurpally and `/rental/swap-stations` returns an empty list. Verified through normal login using the credentials supplied by the user. No vehicles were assigned: all three category availability counts are zero. Contact remains “Contact pending”; hours are 09:00–21:00. A status snapshot is saved in the running container at `/tmp/network-before.json`.

**Local database:** applied the single-hub configuration: Bahadurpally is the only ACTIVE hub; ACTIVE battery stations = 0. Other records were deactivated rather than deleted. Bikes, bookings, rentals and history were preserved and not reassigned. Seeds were updated to use the single-hub/no-station configuration. Do not run the destructive demo seed against production.

The reversible live configuration script is `backend/scripts/configure-single-hub.cjs`. Run it in the backend environment with the intended Railway database credentials:

```sh
node scripts/configure-single-hub.cjs           # show plan
node scripts/configure-single-hub.cjs --apply   # apply reversible status changes
```

Restart the backend after applying externally so cached hub/station lists are cleared. Deploy the backend/admin source changes to make chosen-hub inventory filtering and record management available live. This review does not claim those local source changes were deployed.

In particular, the old live catalogue endpoint may ignore the requested hubId and return overall fleet availability. Deploy the backend filter before relying on model-level availability at Bahadurpally. The home hub totals come from the actual hub endpoint; no vehicles were moved to Bahadurpally in this task.

Repeat the read-only local consistency check after compiling the backend:

```sh
npx tsc
node scripts/check-shared-data.cjs
```

Physical-device acceptance and live rider-account checks remain pending. An automatic approval review rejected creating a live admin token with the local JWT signing key because that method was not explicitly authorized; the command was not executed. Live UI work used the user's signed-in admin session.
