import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { delCache } from '../utils/cache';

/**
 * Employee / staff management. Staff are `User` rows with a non-RIDER role, so
 * they sign in through the same phone-OTP flow — no second credential system.
 * An ADMIN creates them here and sets role, home hub and extra screen grants.
 */

export const STAFF_ROLES = ['ADMIN', 'EXECUTIVE', 'SUPPORT'] as const;

// Screens each role can open by default. `permissions` adds extras on top.
export const ROLE_DEFAULT_SCREENS: Record<string, string[]> = {
  ADMIN: ['overview', 'riders', 'fleet', 'kyc', 'infrastructure', 'finance', 'service', 'recovery', 'employees', 'reports', 'settings'],
  EXECUTIVE: ['overview', 'fleet', 'kyc', 'infrastructure', 'service', 'recovery'],
  SUPPORT: ['overview', 'riders', 'finance', 'recovery'],
};

const genId = () => `usr_${crypto.randomBytes(12).toString('hex')}`;

function normalisePhone(raw: string) {
  let p = String(raw).replace(/[^\d+]/g, '');
  if (!p.startsWith('+')) p = p.length === 10 ? `+91${p}` : `+${p}`;
  return p;
}

// GET /admin/api/staff
export async function listStaff(_req: Request, res: Response) {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
        accountStatus: true,
        permissions: true,
        assignedHubId: true,
        assignedHub: { select: { name: true, city: true } },
        invitedBy: { select: { fullName: true } },
        createdAt: true,
      },
    });

    return res.json({
      count: staff.length,
      roles: STAFF_ROLES,
      roleScreens: ROLE_DEFAULT_SCREENS,
      staff: staff.map((s) => ({
        ...s,
        effectiveScreens: Array.from(
          new Set([...(ROLE_DEFAULT_SCREENS[s.role] || []), ...s.permissions])
        ),
      })),
    });
  } catch (e: any) {
    console.error('listStaff:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/staff  — Body: { phone, fullName, role, email?, assignedHubId?, permissions? }
export async function createStaff(req: AuthRequest, res: Response) {
  try {
    const { phone, fullName, role, email, assignedHubId, permissions } = req.body ?? {};
    if (!phone || !fullName || !role)
      return res.status(400).json({ error: 'phone, fullName and role are required' });
    if (!STAFF_ROLES.includes(role))
      return res.status(400).json({ error: `role must be one of ${STAFF_ROLES.join(', ')}` });

    const normalised = normalisePhone(phone);
    const existing = await prisma.user.findUnique({ where: { phone: normalised } });

    const data = {
      fullName: String(fullName).trim(),
      role,
      email: email ? String(email).trim().toLowerCase() : null,
      assignedHubId: assignedHubId || null,
      permissions: Array.isArray(permissions) ? permissions : [],
      invitedById: req.user?.id ?? null,
      accountStatus: 'ACTIVE',
    };

    let staff;
    if (existing) {
      // Promote an existing account (e.g. a rider who now works at a hub).
      // Never promote a blocked/suspended account — it has to be reactivated
      // deliberately first, so we don't silently revive a banned user as staff.
      if (existing.accountStatus !== 'ACTIVE') {
        return res.status(409).json({
          error: `${normalised} belongs to a ${existing.accountStatus} account — reactivate it before promoting to staff.`,
        });
      }
      staff = await prisma.user.update({ where: { id: existing.id }, data });
      await delCache(`auth:me:${existing.id}`);
    } else {
      staff = await prisma.user.create({
        data: { id: genId(), phone: normalised, ...data },
      });
    }

    return res.status(201).json({
      message: `${role} ${data.fullName} can now sign in with ${normalised} + OTP`,
      staff,
    });
  } catch (e: any) {
    console.error('createStaff:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /admin/api/staff/:id  — role / hub / permissions / status
export async function updateStaff(req: AuthRequest, res: Response) {
  try {
    const { role, assignedHubId, permissions, accountStatus, fullName, email } = req.body ?? {};

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Staff member not found' });

    if (role && !STAFF_ROLES.includes(role) && role !== 'RIDER')
      return res.status(400).json({ error: 'Invalid role' });

    // Guard: never leave zero admins.
    if ((role && role !== 'ADMIN') || accountStatus === 'SUSPENDED') {
      if (target.role === 'ADMIN') {
        const admins = await prisma.user.count({
          where: { role: 'ADMIN', accountStatus: 'ACTIVE' },
        });
        if (admins <= 1)
          return res.status(409).json({ error: 'Cannot demote or suspend the last active admin' });
      }
    }

    const data: any = {};
    if (role) data.role = role;
    if (assignedHubId !== undefined) data.assignedHubId = assignedHubId || null;
    if (Array.isArray(permissions)) data.permissions = permissions;
    if (accountStatus) data.accountStatus = accountStatus;
    if (fullName !== undefined) data.fullName = String(fullName).trim();
    if (email !== undefined) data.email = email ? String(email).trim().toLowerCase() : null;

    const staff = await prisma.user.update({ where: { id: target.id }, data });
    await delCache(`auth:me:${target.id}`);

    return res.json({ message: 'Staff member updated', staff });
  } catch (e: any) {
    console.error('updateStaff:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /admin/api/staff/:id  — revoke staff access (demote to RIDER, keep the account + history)
export async function revokeStaff(req: AuthRequest, res: Response) {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Staff member not found' });
    if (target.id === req.user?.id)
      return res.status(409).json({ error: "You can't revoke your own access" });

    if (target.role === 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN', accountStatus: 'ACTIVE' } });
      if (admins <= 1)
        return res.status(409).json({ error: 'Cannot revoke the last active admin' });
    }

    const staff = await prisma.user.update({
      where: { id: target.id },
      data: { role: 'RIDER', assignedHubId: null, permissions: [] },
    });
    // Kill their sessions so the change takes effect immediately.
    await prisma.session.updateMany({ where: { userId: target.id }, data: { revoked: true } });
    await delCache(`auth:me:${target.id}`);

    return res.json({ message: `${target.fullName || target.phone} reverted to rider access`, staff });
  } catch (e: any) {
    console.error('revokeStaff:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
