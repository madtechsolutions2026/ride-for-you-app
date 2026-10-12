/**
 * Seed the rental-discovery tables from the data the mobile app currently
 * hard-codes (mobile/src/screens/VehiclesListScreen.tsx + CategoryHubsSheet /
 * NearbyHubsSheet). Run once against a fresh DB:
 *
 *   node prisma/seed.js
 *
 * Idempotent: every row uses a fixed id and `upsert`, so re-running only
 * refreshes values. Images stay null — the app uses its bundled artwork until
 * an admin uploads real product photos.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { hub } = require('./network.json');
const HUBS = [hub];
const SWAP_STATIONS = [];

// Official Fleet matching live app & website
const MODELS = [
  {
    id: 'bm_sprinto_hs',
    name: 'SPRINTO HS',
    category: 'SWAP',
    topSpeedKmph: 45,
    rangeKm: 90,
    requiresLicense: false,
    chargerIncluded: false,
    plans: { DAY: 235, WEEK: 1645, MONTH: 5999 },
    deposit: { DAY: 1500, WEEK: 1500, MONTH: 2000 },
    units: 8,
  },
  {
    id: 'bm_evtric',
    name: 'EVTRIC',
    category: 'SWAP',
    topSpeedKmph: 30,
    rangeKm: 90,
    requiresLicense: false,
    chargerIncluded: false,
    plans: { DAY: 230, WEEK: 1610, MONTH: 5899 },
    deposit: { DAY: 1500, WEEK: 1500, MONTH: 2000 },
    units: 8,
  },
  {
    id: 'bm_hala_ckd',
    name: 'HALA CKD',
    category: 'SWAP',
    topSpeedKmph: 35,
    rangeKm: 90,
    requiresLicense: false,
    chargerIncluded: false,
    plans: { DAY: 230, WEEK: 1610, MONTH: 5899 },
    deposit: { DAY: 1500, WEEK: 1500, MONTH: 2000 },
    units: 8,
  },
  {
    id: 'bm_sprinto_hs_sun',
    name: 'SPRINTO HS SUN',
    category: 'SWAP',
    topSpeedKmph: 30,
    rangeKm: 75,
    requiresLicense: false,
    chargerIncluded: false,
    plans: { DAY: 275, WEEK: 1925, MONTH: 6999 },
    deposit: { DAY: 1500, WEEK: 1500, MONTH: 2000 },
    units: 8,
  },
  {
    id: 'bm_new_aeroflow',
    name: 'NEW (Aeroflow)',
    category: 'SWAP',
    topSpeedKmph: 55,
    rangeKm: 110,
    requiresLicense: false,
    chargerIncluded: false,
    plans: { DAY: 275, WEEK: 1925, MONTH: 6999 },
    deposit: { DAY: 1500, WEEK: 1500, MONTH: 2000 },
    units: 8,
  },
  {
    id: 'bm_odyssey',
    name: 'ODYSSEY',
    category: 'SWAP',
    topSpeedKmph: 60,
    rangeKm: 120,
    requiresLicense: false,
    chargerIncluded: false,
    plans: { DAY: 275, WEEK: 1925, MONTH: 6999 },
    deposit: { DAY: 2500, WEEK: 2500, MONTH: 3000 },
    units: 8,
  },
  {
    id: 'bm_home_pro_x1',
    name: 'HOME PRO X1',
    category: 'HOME',
    topSpeedKmph: 60,
    rangeKm: 130,
    requiresLicense: true,
    chargerIncluded: true,
    plans: { WEEK: 1925, MONTH: 6999 },
    deposit: { WEEK: 2000, MONTH: 3000 },
    units: 6,
  },
];

// Fake-but-plausible Telangana plates. Hyderabad RTO codes + an EV-ish series
// letter per model, then a running 4-digit number so every unit is unique.
const RTO_CODES = ['09', '10', '11', '12'];
const PLATE_SERIES = ['EA', 'EB', 'EC', 'ED'];
const COLOURS = ['Teal', 'Graphite', 'Pearl White', 'Midnight Blue'];

function plateFor(modelIndex, runningSeq) {
  const rto = RTO_CODES[modelIndex % RTO_CODES.length];
  const series = PLATE_SERIES[modelIndex % PLATE_SERIES.length];
  return `TS${rto}${series}${String(1000 + runningSeq).padStart(4, '0')}`;
}

async function main() {
  await prisma.hub.updateMany({ where: { id: { not: hub.id } }, data: { status: 'INACTIVE' } });
  await prisma.swapStation.updateMany({ data: { status: 'INACTIVE' } });

  for (const h of HUBS) {
    await prisma.hub.upsert({
      where: { id: h.id },
      update: h,
      create: h,
    });
  }

  for (const s of SWAP_STATIONS) {
    await prisma.swapStation.upsert({ where: { id: s.id }, update: s, create: s });
  }

  let plateSeq = 0;

  for (const [mIdx, m] of MODELS.entries()) {
    const { plans, deposit, units, ...model } = m;

    await prisma.bikeModel.upsert({
      where: { id: model.id },
      update: model,
      create: model,
    });

    for (const [duration, price] of Object.entries(plans)) {
      await prisma.rentalPlan.upsert({
        where: { modelId_duration: { modelId: model.id, duration } },
        update: { price, deposit: deposit[duration] ?? 0 },
        create: { modelId: model.id, duration, price, deposit: deposit[duration] ?? 0 },
      });
    }

    for (let i = 1; i <= units; i += 1) {
      plateSeq += 1;
      const reg = plateFor(mIdx, plateSeq);
      const assignedHub = HUBS[(i - 1) % HUBS.length];

      await prisma.bike.upsert({
        where: { registrationNumber: reg },
        update: { modelId: model.id, hubId: assignedHub.id },
        create: {
          modelId: model.id,
          hubId: assignedHub.id,
          registrationNumber: reg,
          colour: COLOURS[(plateSeq - 1) % COLOURS.length],
          batteryPercent: 90 + (i % 11),
        },
      });
    }
  }

  const [hubs, stations, models, bikes, plans] = await Promise.all([
    prisma.hub.count(),
    prisma.swapStation.count(),
    prisma.bikeModel.count(),
    prisma.bike.count(),
    prisma.rentalPlan.count(),
  ]);
  console.log(
    `Seeded rental discovery: ${hubs} hubs, ${stations} swap stations, ` +
      `${models} models, ${plans} plans, ${bikes} bikes.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
