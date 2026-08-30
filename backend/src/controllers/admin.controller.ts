import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

/**
 * GET /admin/users
 * Returns list of all registered riders with their cached KYC status.
 */
export async function getAllUsers(_req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        fullName: true,
        email: true,
        city: true,
        role: true,
        accountStatus: true,
        kycStatus: true,
        createdAt: true,
      },
    });

    return res.json({
      count: users.length,
      users,
    });
  } catch (error: any) {
    console.error('Error in getAllUsers:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
