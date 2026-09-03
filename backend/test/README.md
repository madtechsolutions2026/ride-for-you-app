# Backend API test suite

Integration tests for the admin-dashboard API surface (`/admin/api/*`, `/auth/*`,
`/kyc/*`). Each test drives the real Express app with `supertest` against a
throwaway Postgres database and asserts on both the HTTP response and the
resulting DB state.

Scenarios trace back to
`Ride_For_You_Dashboard_Testing_Scenarios.xlsx` — every `it(...)` title starts
with the Test Case ID(s) it covers. See `COVERAGE.md` for the full map
(covered / gap / skipped / not-applicable).

## Running

```bash
cd backend
npm test                 # full suite, serial
npx jest test/api/kyc    # one file
npx jest -t "KYC-002"    # one scenario by id
```

Requires the local Postgres container (`ride-for-you-db`, port 5433) to be up.
The suite uses a separate database, `rideforyou_test`, created with:

```bash
psql -h localhost -p 5433 -U rideforyou -d rideforyou -c "CREATE DATABASE rideforyou_test"
```

`globalSetup` runs `prisma db push` against it on every run, so schema changes
are picked up automatically.

## How it works

| Piece | File | Role |
|---|---|---|
| Env bootstrap | `test/setup/env.ts` | loads `.env.test`, forces `NODE_ENV=test`, refuses to run unless `DATABASE_URL` targets a `*_test` DB |
| Schema sync | `test/setup/global-setup.ts` | `prisma db push` once per run |
| Per-test wiring | `test/setup/jest.setup.ts` | truncates every table in `beforeEach`; mocks `utils/cache` (always-miss) and `utils/whatsapp` (no network); silences request logging |
| Data builders | `test/helpers/factories.ts` | `makeUser`, `actingAs`, `makeFleetContext`, `makeActiveRental`, … |
| HTTP client | `test/helpers/api.ts` | `api().get('/admin/api/stats').set(headers)` |

`actingAs('ADMIN')` returns `{ user, token, headers }` — the token is a real JWT
signed with the test secret, so the auth middleware runs for real.

## Conventions

- **`it.failing(...)`** marks a scenario whose secure/expected behaviour is **not
  yet implemented** — the test describes what *should* happen and passes only
  while the gap exists. When the gap is fixed the test flips to failing, which is
  the signal to delete the `.failing`. Each one has a `GAP:` note explaining the
  hole (e.g. `authenticateToken` ignores `accountStatus`).
- **`it.skip(...)`** marks a scenario with nothing to test at the API layer —
  either the feature isn't built (Reports, Notifications, bank-account entity) or
  it's a client-only concern (responsive layout, summary-card navigation). The
  skip message says which.
- One Postgres DB is shared by all files, so Jest runs **serially**
  (`maxWorkers: 1`).
