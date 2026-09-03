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

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, kycStatus: true },
    });
    if (!current) return res.status(404).json({ error: 'User not found' });

    // Once KYC is approved the name is the verified one on the document.
    // Letting the rider edit it silently voids the verification, so changes
    // have to go through support (who re-run KYC).
    if (fullName !== undefined && current.kycStatus === 'APPROVED') {
      const wanted = String(fullName).trim();
      if (wanted && wanted !== (current.fullName ?? '').trim()) {
        return res.status(409).json({
          error:
            'Your name is locked to your verified KYC document. Contact support to change it.',
          code: 'KYC_LOCKED_FIELD',
          field: 'fullName',
        });
      }
    }

    if (email !== undefined && String(email).trim()) {
      const wanted = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wanted)) {
        return res.status(400).json({ error: 'That email address is not valid' });
      }
      const taken = await prisma.user.findFirst({
        where: { email: wanted, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) {
        return res.status(409).json({ error: 'That email is already on another account' });
      }
    }

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

/**
 * POST /user/push-token
 * The app calls this after login once the rider grants notification
 * permission. Storing null is legitimate — it means "stop pushing to me".
 */
export async function registerPushToken(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { token } = req.body ?? {};
    const clean = token ? String(token).trim() : null;

    if (clean && !/^Expo(nent)?PushToken\[.+\]$/.test(clean)) {
      return res.status(400).json({ error: 'Not a valid Expo push token' });
    }

    // A token is unique to a device+install. If it moved to another account,
    // detach it there first so we never push a rider's data to someone else.
    if (clean) {
      await prisma.user.updateMany({
        where: { pushToken: clean, NOT: { id: userId } },
        data: { pushToken: null },
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken: clean, pushTokenUpdatedAt: clean ? new Date() : null },
    });

    await delCache(`user:profile:${userId}`);
    return res.json({ message: clean ? 'Push notifications on' : 'Push notifications off' });
  } catch (error: any) {
    console.error('Error in registerPushToken:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
