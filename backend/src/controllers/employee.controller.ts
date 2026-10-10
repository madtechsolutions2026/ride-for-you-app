import crypto from 'crypto';
import { delCache } from '../utils/cache';
import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

/* -------------------------------------------------------------------------- */
/* 1. EMPLOYEES & HIERARCHY                                                    */
/* -------------------------------------------------------------------------- */

export async function listEmployees(req: AuthRequest, res: Response) {
  try {
    const { hubId, role, status } = req.query;
    const where: any = {};

    if (hubId) where.hubId = String(hubId);
    if (role) where.role = String(role);
    if (status) where.status = String(status);

    const employees = await prisma.employee.findMany({
      where,
      include: {
        hub: { select: { id: true, name: true, city: true } },
        managedHubs: { select: { id: true, name: true } },
        attendances: {
          take: 30,
          orderBy: { date: 'desc' },
        },
        salaries: {
          take: 12,
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: employees, count: employees.length });
  } catch (error: any) {
    console.error('Error in listEmployees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function employeePhone(raw: unknown): string {
  let phone = String(raw ?? '').replace(/[\s()-]/g, '');
  if (/^\d{10}$/.test(phone)) phone = '+91' + phone;
  if (!/^\+\d{10,15}$/.test(phone)) throw new Error('Enter a valid phone number');
  return phone;
}

export async function createEmployee(req: AuthRequest, res: Response) {
  try {
    const { name, email, role, hubId, baseSalary, joinDate } = req.body;
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const phone = employeePhone(req.body.phone);
    if (!Number.isSafeInteger(baseSalary) || baseSalary < 0) return res.status(400).json({ error: 'Monthly salary must be a non-negative whole rupee amount' });
    const joined = joinDate ? new Date(joinDate) : new Date();
    if (!Number.isFinite(joined.getTime())) return res.status(400).json({ error: 'Invalid joining date' });
    const employee = await prisma.$transaction(async tx => {
      const user = await tx.user.upsert({ where: { phone }, create: { id: crypto.randomUUID(), phone, fullName: name.trim(), role: 'EXECUTIVE', assignedHubId: hubId || null }, update: {} });
      if (user.role === 'RIDER') await tx.user.update({ where: { id: user.id }, data: { role: 'EXECUTIVE', assignedHubId: hubId || null } });
      return tx.employee.create({ data: { userId: user.id, name: name.trim(), phone, email: email || null, role: role || 'STAFF', hubId: hubId || null, baseSalary, joinDate: joined }, include: { hub: true } });
    });
    await delCache('auth:me:' + employee.userId);
    return res.status(201).json({ success: true, data: employee });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'This phone or login is already linked to an employee' });
    if (error.message === 'Enter a valid phone number') return res.status(400).json({ error: error.message });
    console.error('createEmployee', error);
    return res.status(500).json({ error: 'Unable to create employee' });
  }
}

export async function updateEmployee(req: AuthRequest, res: Response) {
  try {
    const { name, email, role, hubId, status, baseSalary } = req.body;
    if (baseSalary !== undefined && (!Number.isSafeInteger(baseSalary) || baseSalary < 0)) return res.status(400).json({ error: 'Monthly salary must be a non-negative whole rupee amount' });
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ error: 'Invalid employee status' });
    const employee = await prisma.$transaction(async tx => {
      const current = await tx.employee.findUniqueOrThrow({ where: { id: req.params.id } });
      const phone = employeePhone(req.body.phone ?? current.phone);
      let userId = current.userId;
      if (!userId) {
        const user = await tx.user.upsert({ where: { phone }, create: { id: crypto.randomUUID(), phone, role: 'EXECUTIVE', fullName: name || current.name, assignedHubId: hubId || current.hubId }, update: {} });
        userId = user.id;
        if (user.role === 'RIDER') await tx.user.update({ where: { id: userId }, data: { role: 'EXECUTIVE' } });
      }
      await tx.user.update({ where: { id: userId }, data: { phone, ...(name ? { fullName: name.trim() } : {}), ...(hubId !== undefined ? { assignedHubId: hubId || null } : {}) } });
      // Salary changes invalidate drafts, while paid salary snapshots stay intact.
      if (baseSalary !== undefined && baseSalary !== current.baseSalary) await tx.salary.deleteMany({ where: { employeeId: current.id, status: 'PENDING' } });
      return tx.employee.update({ where: { id: current.id }, data: { userId, phone, ...(name ? { name: name.trim() } : {}), ...(email !== undefined ? { email: email || null } : {}), ...(role ? { role } : {}), ...(hubId !== undefined ? { hubId: hubId || null } : {}), ...(status ? { status } : {}), ...(baseSalary !== undefined ? { baseSalary } : {}) }, include: { hub: true } });
    }, { isolationLevel: 'Serializable' });
    await delCache('auth:me:' + employee.userId);
    return res.json({ success: true, data: employee });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Phone is already linked to another account' });
    if (error.code === 'P2025') return res.status(404).json({ error: 'Employee not found' });
    if (error.code === 'P2034') return res.status(409).json({ error: 'Record changed; retry your update' });
    if (error.message === 'Enter a valid phone number') return res.status(400).json({ error: error.message });
    console.error('updateEmployee', error);
    return res.status(500).json({ error: 'Unable to update employee' });
  }
}

export async function getHierarchy(_req: AuthRequest, res: Response) {
  try {
    const hubs = await prisma.hub.findMany({
      where: { status: 'ACTIVE' },
      include: {
        manager: true,
        employees: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, phone: true, role: true },
        },
        bikes: {
          select: { id: true, status: true, registrationNumber: true, batteryPercent: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const hierarchy = hubs.map((h) => ({
      hubId: h.id,
      hubName: h.name,
      city: h.city,
      manager: h.manager ? { id: h.manager.id, name: h.manager.name, phone: h.manager.phone } : null,
      staffCount: h.employees.length,
      employees: h.employees,
      fleetSummary: {
        total: h.bikes.length,
        available: h.bikes.filter((b) => b.status === 'AVAILABLE').length,
        rented: h.bikes.filter((b) => b.status === 'RENTED').length,
        maintenance: h.bikes.filter((b) => b.status === 'MAINTENANCE').length,
      },
    }));

    return res.json({ success: true, data: hierarchy, count: hierarchy.length });
  } catch (error: any) {
    console.error('Error in getHierarchy:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listDeployments(req: AuthRequest, res: Response) {
  try {
    const { hubId, bikeId, riderId } = req.query;
    const where: any = {};

    if (hubId) where.hubId = String(hubId);
    if (bikeId) where.bikeId = String(bikeId);
    if (riderId) where.riderId = String(riderId);

    const logs = await prisma.bikeDeploymentLog.findMany({
      where,
      include: {
        bike: { select: { registrationNumber: true, model: { select: { name: true } } } },
        hub: { select: { id: true, name: true, city: true } },
        rider: { select: { id: true, fullName: true, phone: true } },
        deployedByEmployee: { select: { id: true, name: true, role: true } },
        booking: { select: { reference: true, rentAmount: true } },
      },
      orderBy: { deployedAt: 'desc' },
      take: 100,
    });

    return res.json({ success: true, data: logs, count: logs.length });
  } catch (error: any) {
    console.error('Error in listDeployments:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
