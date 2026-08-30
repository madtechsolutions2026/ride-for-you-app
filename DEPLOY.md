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
| Setting       | Value                                                     |
| ------------- | --------------------------------------------------------- |
| Root Directory| `backend`                                                  |
| Build Command | `npm install && npm run build`                             |
| Start Command | `npx prisma migrate deploy && npm start`                   |

`postinstall` runs `prisma generate`. `migrate deploy` applies
`prisma/migrations/` — it only adds what's missing and never drops data.

### 4. Deploy, then verify
```bash
curl https://ride-for-you-app.onrender.com/health
```

> **Free tier note:** the service sleeps after ~15 min idle, so the first
> request can take 30–60s. The mobile client already allows a 45s timeout.
> Database contents survive this — only the old SQLite file did not.

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
`eas update`. Installed APKs pick the change up on next launch.

One-time setup: add an **`EXPO_TOKEN`** repository secret
(expo.dev → Account Settings → Access Tokens).

### Manual
```bash
cd mobile
eas update --branch production --message "what changed"
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
