import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { getCache, setCache, delCache } from '../utils/cache';

/**
 * GET /user/profile
 * Retrieves the authenticated rider's profile plus a short KYC summary.
 * High-speed cached for jet speed navigation (<0.1ms).
 */
export async function getProfile(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cacheKey = `user:profile:${userId}`;
    const cached = await getCache<{ user: any; kyc: any }>(cacheKey);
    if (cached) {
      return res.json(cached);
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
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const latestKyc = await prisma.kycVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        rejectReason: true,
      },
    });

    const responsePayload = { user, kyc: latestKyc };
    await setCache(cacheKey, responsePayload, 180); // cache for 3 minutes

    return res.json(responsePayload);
  } catch (error: any) {
    console.error('Error in getProfile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /user/profile
 * Updates the rider's personal details (Name, Email, City, Avatar).
 * Instantly invalidates user cache.
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

    // Invalidate caches instantly
    await delCache(`user:profile:${userId}`);
    await delCache(`auth:me:${userId}`);

    return res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error in updateProfile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
