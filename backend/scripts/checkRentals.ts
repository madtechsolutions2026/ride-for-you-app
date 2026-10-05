import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const rentals = await prisma.rental.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, userId: true, createdAt: true, nextBillingDate: true }
    });
    console.log('Active rentals:', rentals);
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
