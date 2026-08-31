# Deploying Ride For You

## Backend — Render

The app uses **PostgreSQL**. It used to use SQLite with `dev.db` committed to
git; on Render that file was baked into the deploy image and restored on every
container restart, silently reverting live data. Don't go back to that.

### 1. Create the database
Render dashboard → **New +** → **PostgreSQL** (free tier is fine).
Once it's ready, copy the **Internal Database URL**.

### 2. Point the web service at it
On the backend service → **Environment**:

| Key            | Value                                              |
| -------------- | -------------------------------------------------- |
| `DATABASE_URL` | the Internal Database URL from step 1               |
| `JWT_SECRET`   | a long random string (NOT the default in `.env`)    |

There is deliberately no SQLite fallback — if `DATABASE_URL` is missing the
server refuses to start instead of quietly writing to a disposable file.

### 3. Set the commands
| Setting        | Value                             |
| -------------- | --------------------------------- |
| Root Directory | `backend`                         |
| Build Command  | `npm install && npm run build`    |
| Start Command  | `npm start`                       |

- `postinstall` runs `prisma generate`.
- `build` compiles the API **and** builds the admin dashboard
  (`npm --prefix ../admin ci && npm --prefix ../admin run build`) into
  `admin/dist`, which `app.ts` serves at `/admin/`. There is no committed
  build output any more.
- `start` = `prisma db push && node dist/app.js`. Plain `db push` (no
  `--accept-data-loss`) applies additive schema changes on boot and **exits
  non-zero on any destructive change** instead of dropping data unattended.
  Schema history is managed with `db push`, not a migrations folder.

### 4. Deploy, then verify
```bash
curl https://ride-for-you-app.onrender.com/health
```

> **Free tier note:** the service sleeps after ~15 min idle, so the first
> request can take 30–60s. The mobile client already allows a 45s timeout.
> Database contents survive this — only the old SQLite file did not.

### Admin dashboard access
The dashboard is at `/admin/`. Staff sign in with **phone + OTP** (dev master
code `123456`). `ADMIN_PHONES` in `auth.controller.ts` auto-elevates the
seeded admin numbers; every other staff member is created from
**Employees & Roles** inside the dashboard. Roles: ADMIN (everything),
EXECUTIVE (hub floor), SUPPORT (riders + payments).

### Cloudflare R2 (KYC documents)
Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
on Render too, or KYC uploads return 503 and submitted documents won't be
viewable in the review queue.

## Local backend
```bash
cd backend
# set DATABASE_URL in .env to your local Postgres, then:
npx prisma migrate dev
npm run dev
```

## Mobile — shipping changes to an installed APK

`expo-updates` is configured, so most changes reach phones over the air.

### Automatic (preferred)
Push to `main`. `.github/workflows/eas-update.yml` typechecks and runs
`eas update` on the **preview** branch — the channel a `--profile preview`
APK listens on. Installed APKs pick the change up on next launch.

> Channels map 1:1 to branches by name. A `--profile production` build listens
> on `production`, so publish there instead if you ship that profile.

One-time setup: add an **`EXPO_TOKEN`** repository secret
(expo.dev → Account Settings → Access Tokens).

### Manual
```bash
cd mobile
eas update --branch preview --message "what changed"
```

### When you must rebuild instead
OTA ships **JS, styles and assets only**. A new *native* dependency
(`expo-camera`, `react-native-maps`, …) needs a real build:
```bash
cd mobile
eas build -p android --profile preview
```
Then install the new APK. `runtimeVersion` follows `appVersion`, so bump
`version` in `app.json` when you make a native change — that keeps old APKs
from pulling an update they can't run.
