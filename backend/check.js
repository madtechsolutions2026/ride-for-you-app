const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.kycVerification.findMany().then(console.log).finally(() => prisma.$disconnect());
