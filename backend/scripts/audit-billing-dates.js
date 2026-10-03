/**
 * Read-only billing-date audit.
 *
 * Answers the question Balram asked: is each week's due date anchored to the
 * handover (deployment) date, or has it drifted towards whenever the rider
 * happened to pay?
 *
 * For every live rental it prints the handover date and each week's
 * periodStart / dueAt / paidAt, plus two derived numbers that settle it:
 *
 *   gap      days between this week's dueAt and the previous week's.
 *            Should be exactly 7. Anything else is real drift.
 *   raisedIn days between the week's periodStart and when the invoice row was
 *            actually created. Should be ~0 (the midnight job raised it on
 *            time). A large number means the job did not run that night — on
 *            Render's free tier the service sleeps and the in-process timer
 *            sleeps with it, so the bill is only raised when something wakes
 *            the server, which is usually a rider opening the app to pay.
 *
 * Writes nothing. Safe to run against production.
 *
 *   cd backend
 *   DATABASE_URL="<render external database url>" node scripts/audit-billing-dates.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;

const ist = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '—';

const days = (a, b) => (new Date(a).getTime() - new Date(b).getTime()) / DAY_MS;
const pad = (s, n) => String(s).padEnd(n);

async function main() {
  const rentals = await prisma.rental.findMany({
    where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
    orderBy: { handoverAt: 'asc' },
    include: {
      user: { select: { fullName: true, phone: true } },
      bike: { select: { registrationNumber: true } },
      weeklyInvoices: { orderBy: { weekNumber: 'asc' } },
    },
  });

  if (!rentals.length) {
    console.log('No ACTIVE or OVERDUE rentals found.');
    return;
  }

  const drifted = [];
  const raisedLate = [];

  for (const r of rentals) {
    console.log('');
    console.log('='.repeat(96));
    console.log(
      `${r.user.fullName || 'Rider'} · ${r.user.phone} · ${r.bike?.registrationNumber ?? 'no bike'} · ${r.status}`,
    );
    console.log(`handover (deployment): ${ist(r.handoverAt)}`);
    console.log('-'.repeat(96));
    console.log(
      `${pad('wk', 4)}${pad('periodStart', 20)}${pad('dueAt', 20)}${pad('paidAt', 20)}${pad('gap', 7)}${pad('raisedIn', 10)}status`,
    );

    let prevDue = null;
    for (const inv of r.weeklyInvoices) {
      const gap = prevDue === null ? null : days(inv.dueAt, prevDue);
      const raisedIn = days(inv.createdAt, inv.periodStart);

      // Week 1 is created at handover, so its raisedIn is meaningless.
      const lateRaise = inv.weekNumber > 1 && raisedIn > 1.5;
      const badGap = gap !== null && Math.abs(gap - 7) > 0.5;

      if (badGap) drifted.push({ rental: r, inv, gap });
      if (lateRaise) raisedLate.push({ rental: r, inv, raisedIn });

      console.log(
        pad(inv.weekNumber, 4) +
          pad(ist(inv.periodStart), 20) +
          pad(ist(inv.dueAt), 20) +
          pad(ist(inv.paidAt), 20) +
          pad(gap === null ? '—' : gap.toFixed(1) + (badGap ? ' !' : ''), 7) +
          pad(raisedIn.toFixed(1) + (lateRaise ? ' !' : ''), 10) +
          inv.status,
      );

      prevDue = inv.dueAt;
    }

    // What the anniversary SHOULD be, ignoring everything that has happened.
    const expectedNext = new Date(
      new Date(r.handoverAt).getTime() + r.weeklyInvoices.length * 7 * DAY_MS,
    );
    const actualNext = r.weeklyInvoices[r.weeklyInvoices.length - 1]?.dueAt;
    if (actualNext) {
      const off = days(actualNext, expectedNext);
      console.log(
        `latest dueAt is ${off.toFixed(1)} day(s) from the handover anniversary ` +
          `(expected ${ist(expectedNext)}, actual ${ist(actualNext)})`,
      );
    }
  }

  console.log('');
  console.log('='.repeat(96));
  console.log('VERDICT');
  console.log('='.repeat(96));

  if (!drifted.length) {
    console.log('✓ No due-date drift. Every week sits exactly 7 days after the last.');
    console.log('  The cycle is anchored to the handover date, not to payments.');
  } else {
    console.log(`✗ ${drifted.length} week(s) are NOT 7 days after the previous week:`);
    for (const d of drifted) {
      console.log(
        `    ${d.rental.user.phone} week ${d.inv.weekNumber}: gap ${d.gap.toFixed(1)} days`,
      );
    }
  }

  console.log('');
  if (!raisedLate.length) {
    console.log('✓ Every invoice was raised on time by the midnight job.');
  } else {
    console.log(
      `✗ ${raisedLate.length} invoice(s) were raised late — the midnight job did not run that night.`,
    );
    console.log('  On Render free tier the service sleeps and the in-process timer sleeps with it,');
    console.log('  so the bill is only raised when something wakes the server.');
    for (const d of raisedLate) {
      console.log(
        `    ${d.rental.user.phone} week ${d.inv.weekNumber}: raised ${d.raisedIn.toFixed(1)} days into the period`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
