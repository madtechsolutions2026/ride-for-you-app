import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * GET /user/profile
 * Retrieves the authenticated rider's profile and KYC verification status.
 */
export async function getProfile(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        fullName: true,
        email: true,
        city: true,
        avatarUrl: true,
        role: true,
        accountStatus: true,
        kycStatus: true,
        kycSubmittedAt: true,
        kycReviewedAt: true,
        kycRejectReason: true,
        aadhaarNumber: true,
        addressProof: true,
        selfieUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error: any) {
    console.error('Error in getProfile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /user/profile
 * Updates the rider's personal details (Name, Email, City, Avatar).
 */
export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fullName, email, city, avatarUrl } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName !== undefined && { fullName: String(fullName).trim() }),
        ...(email !== undefined && { email: String(email).trim().toLowerCase() }),
        ...(city !== undefined && { city: String(city).trim() }),
        ...(avatarUrl !== undefined && { avatarUrl: String(avatarUrl).trim() }),
      },
      select: {
        id: true,
        phone: true,
        fullName: true,
        email: true,
        city: true,
        avatarUrl: true,
        role: true,
        kycStatus: true,
        updatedAt: true,
      },
    });

    return res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error in updateProfile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /user/kyc/submit
 * Submits KYC documents and sets status to SUBMITTED (Under Review).
 */
export async function submitKyc(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { aadhaarNumber, addressProof, selfieUrl } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'SUBMITTED',
        kycSubmittedAt: new Date(),
        kycRejectReason: null,
        ...(aadhaarNumber && { aadhaarNumber: String(aadhaarNumber) }),
        ...(addressProof && { addressProof: String(addressProof) }),
        ...(selfieUrl && { selfieUrl: String(selfieUrl) }),
      },
      select: {
        id: true,
        phone: true,
        fullName: true,
        kycStatus: true,
        kycSubmittedAt: true,
      },
    });

    console.log(`\n========================================`);
    console.log(`[KYC SUBMITTED] User: ${userId} (${updatedUser.phone})`);
    console.log(`Status changed to: SUBMITTED (Awaiting Admin Review)`);
    console.log(`========================================\n`);

    return res.json({
      message: 'KYC documents submitted successfully. Our team will review them shortly.',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error in submitKyc:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
