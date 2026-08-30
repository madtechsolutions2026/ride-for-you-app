import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

/*
 * No SQLite fallback here on purpose.
 *
 * There used to be one that pointed DATABASE_URL at a local dev.db file. On a
 * host like Render that is a silent data-loss trap: if the env var is ever
 * missing the app happily writes to a file on an ephemeral disk, and every
 * restart throws those writes away. Failing loudly is much safer.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Point it at your Postgres instance ' +
      '(see backend/.env.example).'
  );
}

export const prisma = new PrismaClient();
