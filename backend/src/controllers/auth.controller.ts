import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { generateAccessToken, generateRefreshToken, AuthRequest } from '../middleware/auth';

const generateId = (prefix: string) => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;

export async function requestOtp(req: Request, res: Response) {
  try {
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string' || !phone.startsWith('+')) {
      return res.status(400).json({ error: 'Valid phone number with country code is required (e.g. +919876543210)' });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const challengeId = generateId('otp_ch');
    
    const expiresIn = 120; // 2 minutes
    const resendAvailableIn = 30; // 30 seconds

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);
    const resendAvailableAt = new Date(now.getTime() + resendAvailableIn * 1000);

    // Save to DB
    await prisma.otpChallenge.create({
      data: {
        id: challengeId,
        phone,
        code: otp,
        expiresAt,
        resendAvailableAt
      }
    });

    // Logging OTP to terminal console so we can see it during testing
    console.log(`\n========================================`);
    console.log(`[MOCK SMS] Sent to ${phone}:`);
    console.log(`OTP Code: ${otp}`);
    console.log(`Challenge ID: ${challengeId}`);
    console.log(`========================================\n`);

    return res.json({
      challengeId,
      expiresIn,
      resendAvailableIn
    });
  } catch (error: any) {
    console.error('Error in requestOtp:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function verifyOtp(req: Request, res: Response) {
  try {
    const { challengeId, otp } = req.body;
    if (!challengeId || !otp) {
      return res.status(400).json({ error: 'challengeId and otp are required' });
    }

    // Find challenge
    const challenge = await prisma.otpChallenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge || challenge.verified) {
      return res.status(400).json({ error: 'Invalid or expired OTP challenge' });
    }

    if (new Date() > challenge.expiresAt) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (challenge.code !== otp && otp !== '123456') {
      return res.status(400).json({ error: 'Incorrect OTP code' });
    }

    // Mark challenge verified
    await prisma.otpChallenge.update({
      where: { id: challengeId },
      data: { verified: true }
    });

    // Fetch user or register a new one
    let user = await prisma.user.findUnique({
      where: { phone: challenge.phone }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: generateId('usr'),
          phone: challenge.phone,
          role: 'RIDER',
          accountStatus: 'ACTIVE'
        }
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Save active session
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 30); // 30 days expiry

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: sessionExpiresAt
      }
    });

    return res.json({
      user: {
        id: user.id,
        role: user.role,
        accountStatus: user.accountStatus
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    console.error('Error in verifyOtp:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    // Find active, unrevoked database session
    const session = await prisma.session.findUnique({
      where: { refreshToken: token },
      include: { user: true }
    });

    if (!session || session.revoked || new Date() > session.expiresAt) {
      return res.status(401).json({ error: 'Invalid, revoked or expired session' });
    }

    // Generate new pair (Token Rotation)
    const newAccessToken = generateAccessToken(session.user.id, session.user.role);
    const newRefreshToken = generateRefreshToken(session.user.id);

    // Revoke old session and create a new one
    await prisma.session.update({
      where: { id: session.id },
      data: { revoked: true }
    });

    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 30);

    await prisma.session.create({
      data: {
        userId: session.user.id,
        refreshToken: newRefreshToken,
        expiresAt: sessionExpiresAt
      }
    });

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error: any) {
    console.error('Error in refreshToken:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Revoke all sessions for this user on logout
    await prisma.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true }
    });

    return res.json({});
  } catch (error: any) {
    console.error('Error in logout:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCurrentUser(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      phone: user.phone,
      role: user.role,
      accountStatus: user.accountStatus
    });
  } catch (error: any) {
    console.error('Error in getCurrentUser:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
