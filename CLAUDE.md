# Ride For You — Rider App (NEW BUILD, NOT YET LIVE)

## Read this first: there are two Ride For You codebases

This is the **new build**: customer-facing mobile app, new backend, new admin
dashboard. It is **not** the system currently running Balram's business.

|                  | **This repo**                                  | The old dashboard                     |
| ---------------- | ---------------------------------------------- | ------------------------------------- |
| What it is       | Rider mobile app + new backend + new admin     | Internal ops dashboard, admin-only    |
| Folder           | `C:\Users\madte\ride-for-you`                   | `D:\Dev\madtech\ride`                 |
| GitHub           | `madtechsolutions2026/ride-for-you-app`         | `Madhukunchalaa/ride-for-you`         |
| Stack            | Express + Prisma/Postgres, Expo RN, React admin | Express + MongoDB/Mongoose, React     |
| Status           | In development                                  | **Live. Real riders, real payments.** |

The names are crossed over: this folder is called `ride-for-you`, but the repo
actually *named* `ride-for-you` is the old dashboard. Check the stack to be
certain — **Prisma means you are here; Mongoose means you are in the old one.**

Bugs Balram reports against "the dashboard" are almost always the old system.
Nothing here is taking live traffic yet, so a defect reported by a real rider
did not come from this code.

## Layout

```
backend/   Express + TypeScript + Prisma + Postgres
mobile/    Expo / React Native (18 screens)
admin/     React + Vite, built into admin/dist and served at /admin/
```

## What is built

Phone+OTP auth, KYC with R2 document upload, bookings with timed holds,
handover/return, weekly invoicing, the full collections ladder (reminder →
final warning → recovery job), wallet credit, battery swaps, support tickets,
employees and payroll, reports.

Payments: both halves are written — order creation and webhook, signatures
verified, settlement idempotent on the provider's payment id. It starts working
when real keys land in the environment (`PAYMENTS_MODE`). That is configuration,
not development.

## What is NOT built — do not describe these as working

- **IoT telemetry ingestion.** `Bike.lastLat` / `lastLng` / `lastSeenAt` exist
  in the schema and the fleet map reads them, but **nothing writes them**. There
  is no ingest route, no device identity field (no IMEI / device id on `Bike`),
  and no device authentication.
- **Fleet map remote commands are simulated.** `handleCommand` in
  `admin/src/components/FleetLiveMap.tsx` is a `setTimeout` that prints
  "✓ Command confirmed by onboard IoT ECU" without contacting anything.
- **Fleet map stats are hardcoded literals** — "GPS Lock: 54/54 Online",
  "Avg Fleet SoC: 78%", "2-Min Swaps Today: 89". They display those numbers
  whether or not any device is connected. Replace before showing the client.
- `README.md` is stale: it claims SQLite and "the rest is static UI". Neither
  is true any more — see `DEPLOY.md` for how it actually deploys (Render +
  Postgres).

## Billing model

Week 1 is raised at handover (`ops.controller.ts`). Every later week is chained
by the nightly job in `backend/src/services/collections.ts`: `periodStart` is
the previous `periodEnd`, so due dates stay anchored regardless of when payment
arrives. Keep it that way — the old dashboard shipped the opposite bug and it
silently forgave overdue rent.

**Deployment caveat:** Render's free tier sleeps after ~15 minutes idle, and the
midnight billing job is an in-process timer, so it sleeps too. Billing then only
runs when something wakes the service. If riders report bills arriving at odd
times, that is the cause — not the date arithmetic.
