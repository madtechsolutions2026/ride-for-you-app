import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

/**
 * GET /admin/kyc/pending
 * Retrieves all riders with kycStatus = 'SUBMITTED' awaiting approval.
 */
export async function getPendingKyc(req: Request, res: Response) {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { kycStatus: 'SUBMITTED' },
      orderBy: { kycSubmittedAt: 'desc' },
      select: {
        id: true,
        phone: true,
        fullName: true,
        email: true,
        city: true,
        avatarUrl: true,
        kycStatus: true,
        kycSubmittedAt: true,
        aadhaarNumber: true,
        addressProof: true,
        selfieUrl: true,
        createdAt: true,
      },
    });

    return res.json({
      count: pendingUsers.length,
      users: pendingUsers,
    });
  } catch (error: any) {
    console.error('Error in getPendingKyc:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /admin/kyc/review
 * Approves or Rejects a rider's KYC verification.
 * Body: { userId: string, action: "APPROVE" | "REJECT", reason?: string }
 */
export async function reviewKyc(req: Request, res: Response) {
  try {
    const { userId, action, reason } = req.body;

    if (!userId || !action || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid input. userId and action ("APPROVE" or "REJECT") are required.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newKycStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: newKycStatus,
        kycReviewedAt: new Date(),
        kycRejectReason: action === 'REJECT' ? (reason || 'Documents could not be verified') : null,
      },
      select: {
        id: true,
        phone: true,
        fullName: true,
        kycStatus: true,
        kycReviewedAt: true,
        kycRejectReason: true,
      },
    });

    console.log(`\n========================================`);
    console.log(`[KYC REVIEWED] User: ${userId} (${updatedUser.phone})`);
    console.log(`New Status: ${newKycStatus} ${action === 'REJECT' ? `(Reason: ${reason})` : ''}`);
    console.log(`========================================\n`);

    return res.json({
      message: `KYC for ${updatedUser.phone} has been ${action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}.`,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error in reviewKyc:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /admin/users
 * Returns list of all registered riders with their KYC status.
 */
export async function getAllUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        fullName: true,
        email: true,
        city: true,
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
