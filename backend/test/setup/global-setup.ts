/**
 * Jest `globalSetup` — runs once, in its own process, before the suite.
 * Syncs the Prisma schema to the test database so a fresh clone / CI box needs
 * no manual `prisma db push`.
 */
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

export default function globalSetup(): void {
  const backendRoot = path.resolve(__dirname, '../..');
  dotenv.config({ path: path.join(backendRoot, '.env.test'), override: true });

  const url = process.env.DATABASE_URL ?? '';
  if (!/_test(\?|$)/.test(url)) {
    throw new Error(`global-setup: DATABASE_URL is not a *_test database (${url})`);
  }

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });
}
