// Reversible configuration change: preserve every linked operational record.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { hub } = require('../prisma/network.json');
const prisma = new PrismaClient();
async function main() {
  if (!process.argv.includes('--apply')) {
    console.log('Plan: activate Bahadurpally, deactivate all other hubs and all battery stations. No bikes, bookings, rentals, or history will be deleted or moved. Add --apply to execute.');
    return;
  }
  await prisma.$transaction(async tx => {
    const existing = await tx.hub.findFirst({ where: { OR: [{ id: hub.id }, { name: { contains: 'Bahadurpally', mode: 'insensitive' } }] } });
    const { id, ...details } = hub;
    const configured = existing
      ? await tx.hub.update({ where: { id: existing.id }, data: details })
      : await tx.hub.create({ data: hub });
    await tx.hub.updateMany({ where: { id: { not: configured.id } }, data: { status: 'INACTIVE' } });
    await tx.swapStation.updateMany({ data: { status: 'INACTIVE' } });
  }, { isolationLevel: 'Serializable' });
  console.log(JSON.stringify({ activeHubs: await prisma.hub.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true, lat: true, lng: true } }), activeBatteryStations: await prisma.swapStation.count({ where: { status: 'ACTIVE' } }) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
