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

const HUBS = [
  {
    id: 'hub_kondapur',
    name: 'Ride For You – Kondapur Hub',
    address: 'RTO Office Road, Near Botanical Garden, Kondapur, Hyderabad',
    lat: 17.462,
    lng: 78.356,
    city: 'Hyderabad',
    openTime: '09:00',
    closeTime: '21:00',
    contactPhone: '+914012345678',
  },
  {
    id: 'hub_hitech',
    name: 'Ride For You – Hitech Metro Hub',
    address: 'Near Hitech City Metro Station, Madhapur, Hyderabad',
    lat: 17.448,
    lng: 78.378,
    city: 'Hyderabad',
    openTime: '08:00',
    closeTime: '22:00',
    contactPhone: '+914012345679',
  },
  {
    id: 'hub_gachibowli',
    name: 'Ride For You – Gachibowli Hub',
    address: 'Financial District, Near Wipro Circle, Gachibowli, Hyderabad',
    lat: 17.432,
    lng: 78.345,
    city: 'Hyderabad',
    openTime: '08:30',
    closeTime: '21:30',
    contactPhone: '+914012345680',
  },
];

const SWAP_STATIONS = [
  {
    id: 'sw_hitech_metro',
    name: 'Hitech City Metro Swap Point',
    address: 'Near Pillar 1240, Hitech City Main Rd',
    lat: 17.4435,
    lng: 78.3772,
    openTime: '06:00',
    closeTime: '23:00',
  },
  {
    id: 'sw_cyber_towers',
    name: 'Madhapur Cyber Towers Swap Point',
    address: 'Opp. Cyber Gateway, Madhapur',
    lat: 17.4504,
    lng: 78.3808,
    openTime: '06:00',
    closeTime: '23:00',
  },
  {
    id: 'sw_gachibowli',
    name: 'Gachibowli Bio-Diversity Swap Point',
    address: 'Near Bio-Diversity Junction, Gachibowli',
    lat: 17.4334,
    lng: 78.3668,
    openTime: '06:00',
    closeTime: '23:00',
  },
];

// From FLEET_DATA. `plans` = pricePerDay / Week / Month.
const MODELS = [
  {
    id: 'bm_swapper_s1_pro',
    name: 'RFY Swapper S1 Pro',
    category: 'SWAP',
    topSpeedKmph: 55,
    rangeKm: 110,
    requiresLicense: false,
    chargerIncluded: false,
    plans: { DAY: 249, WEEK: 1499, MONTH: 5499 },
    deposit: { DAY: 1000, WEEK: 1000, MONTH: 2000 },
    units: 6,
  },
  {
    id: 'bm_swapper_s1_eco',
    name: 'RFY Swapper S1 Eco',
    category: 'SWAP',
    topSpeedKmph: 45,
    rangeKm: 95,
    requiresLicense: false,
    chargerIncluded: false,
    plans: { DAY: 199, WEEK: 1199, MONTH: 4499 },
    deposit: { DAY: 1000, WEEK: 1000, MONTH: 2000 },
    units: 8,
  },
  {
    id: 'bm_home_pro_x1_max',
    name: 'RFY Home Pro X1 Max',
    category: 'HOME',
    topSpeedKmph: 60,
    rangeKm: 130,
    requiresLicense: true,
    chargerIncluded: true,
    plans: { WEEK: 1799, MONTH: 6499 },
    deposit: { WEEK: 3000, MONTH: 5000 },
    units: 7,
  },
  {
    id: 'bm_home_city_x1',
    name: 'RFY Home City X1',
    category: 'HOME',
    topSpeedKmph: 50,
    rangeKm: 105,
    requiresLicense: true,
    chargerIncluded: true,
    plans: { WEEK: 1399, MONTH: 4999 },
    deposit: { WEEK: 3000, MONTH: 5000 },
    units: 5,
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
  await prisma.bike.deleteMany({});

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
