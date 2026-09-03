/**
 * Runs first (jest `setupFiles`), before any application module is imported.
 * Loads .env.test so DATABASE_URL / JWT_SECRET are in place when
 * utils/prisma.ts and middleware/auth.ts read them at import time.
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

process.env.NODE_ENV = 'test';

if (!process.env.DATABASE_URL || !/_test(\?|$)/.test(process.env.DATABASE_URL)) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL does not point at a *_test database ` +
      `(got ${process.env.DATABASE_URL ?? 'undefined'}). Check backend/.env.test.`
  );
}
