/**
 * Jest `setupFilesAfterEnv` — applied to every test file.
 *
 *  - Replaces utils/cache with always-miss no-ops so a cached KPI payload never
 *    hides the DB state a test just wrote.
 *  - Replaces utils/whatsapp so the OTP / KYC / booking flows make no network call.
 *  - Truncates every table before each test and manages the Prisma connection.
 */
import { prisma } from '../../src/utils/prisma';

jest.mock('../../src/utils/cache', () => ({
  getCache: jest.fn(async () => null),
  setCache: jest.fn(async () => undefined),
  delCache: jest.fn(async () => undefined),
  delCachePrefix: jest.fn(async () => undefined),
}));

jest.mock('../../src/utils/whatsapp', () => ({
  sendWhatsAppOtp: jest.fn(async () => true),
  sendKycApprovalWhatsApp: jest.fn(async () => true),
  sendBookingConfirmationWhatsApp: jest.fn(async () => true),
}));

// Belt and braces: any stray fetch (e.g. Way2Chats) resolves instead of hitting
// the network.
global.fetch = jest.fn(async () =>
  new Response(JSON.stringify({ id: 'test' }), { status: 200 })
) as unknown as typeof fetch;

// The app logs every request + internal catch blocks; keep the test output clean.
for (const level of ['log', 'info', 'warn', 'error'] as const) {
  jest.spyOn(console, level).mockImplementation(() => {});
}

let tableList: string[] = [];

async function loadTableList(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  return rows.map((r) => `"${r.tablename}"`);
}

export async function resetDb(): Promise<void> {
  if (tableList.length === 0) tableList = await loadTableList();
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList.join(', ')} RESTART IDENTITY CASCADE;`
  );
}

beforeAll(async () => {
  await prisma.$connect();
  tableList = await loadTableList();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
