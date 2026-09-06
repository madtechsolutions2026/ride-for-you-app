import { Request, Response } from 'express';
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

    return res.json({ count: employees.length, employees });
  } catch (error: any) {
    console.error('Error in listEmployees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createEmployee(req: AuthRequest, res: Response) {
  try {
    const { name, phone, email, role, hubId, baseSalary, joinDate } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const cleanPhone = phone.trim();
    const existing = await prisma.employee.findUnique({ where: { phone: cleanPhone } });
    if (existing) {
      return res.status(409).json({ error: 'Employee with this phone already exists' });
    }

    const employee = await prisma.employee.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        email: email ? email.trim() : null,
        role: role || 'STAFF',
        hubId: hubId || null,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        status: 'ACTIVE',
      },
      include: { hub: true },
    });

    if (typeof baseSalary === 'number' && baseSalary > 0) {
      const now = new Date();
      await prisma.salary.create({
        data: {
          employeeId: employee.id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          baseSalary: baseSalary,
          netPaid: baseSalary,
          status: 'PENDING',
        },
      }).catch(() => {});
    }

    return res.status(201).json({ message: 'Employee added successfully', employee });
  } catch (error: any) {
    console.error('Error in createEmployee:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateEmployee(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, phone, email, role, hubId, status } = req.body;

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(phone ? { phone: phone.trim() } : {}),
        ...(email !== undefined ? { email: email ? email.trim() : null } : {}),
        ...(role ? { role } : {}),
        ...(hubId !== undefined ? { hubId: hubId || null } : {}),
        ...(status ? { status } : {}),
      },
      include: { hub: true },
    });

    return res.json({ message: 'Employee updated', employee: updated });
  } catch (error: any) {
    console.error('Error in updateEmployee:', error);
    return res.status(500).json({ error: 'Internal server error' });
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

    return res.json({ count: hierarchy.length, hierarchy });
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

    return res.json({ count: logs.length, deployments: logs });
  } catch (error: any) {
    console.error('Error in listDeployments:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* 2. ATTENDANCE MANAGEMENT                                                   */
/* -------------------------------------------------------------------------- */

export async function getAttendance(req: AuthRequest, res: Response) {
  try {
    const { employeeId, hubId, month, year } = req.query;
    const m = month ? parseInt(String(month), 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(String(year), 10) : new Date().getFullYear();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const where: any = {
      date: { gte: startDate, lte: endDate },
    };
    if (employeeId) where.employeeId = String(employeeId);
    if (hubId) where.employee = { hubId: String(hubId) };

    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, phone: true, role: true, hubId: true } },
      },
      orderBy: [{ date: 'asc' }, { employee: { name: 'asc' } }],
    });

    return res.json({ month: m, year: y, count: records.length, attendance: records });
  } catch (error: any) {
    console.error('Error in getAttendance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markAttendance(req: AuthRequest, res: Response) {
  try {
    const { employeeId, date, status, note, checkInTime, checkOutTime } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });

    const attDate = date ? new Date(date) : new Date();
    attDate.setHours(0, 0, 0, 0);

    const record = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: attDate,
        },
      },
      update: {
        status: status || 'PRESENT',
        note: note || null,
        ...(checkInTime ? { checkInTime: new Date(checkInTime) } : {}),
        ...(checkOutTime ? { checkOutTime: new Date(checkOutTime) } : {}),
      },
      create: {
        employeeId,
        date: attDate,
        status: status || 'PRESENT',
        note: note || null,
        checkInTime: checkInTime ? new Date(checkInTime) : new Date(),
        checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
      },
      include: { employee: true },
    });

    return res.json({ message: 'Attendance marked successfully', attendance: record });
  } catch (error: any) {
    console.error('Error in markAttendance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* 3. SALARY & PAYROLL MANAGEMENT                                             */
/* -------------------------------------------------------------------------- */

export async function listSalaries(req: AuthRequest, res: Response) {
  try {
    const { month, year, hubId, status } = req.query;
    const m = month ? parseInt(String(month), 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(String(year), 10) : new Date().getFullYear();

    const where: any = { month: m, year: y };
    if (status) where.status = String(status);
    if (hubId) where.employee = { hubId: String(hubId) };

    const salaries = await prisma.salary.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            hub: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ employee: { name: 'asc' } }],
    });

    const totalPayout = salaries.reduce((acc, s) => acc + s.netPaid, 0);
    const paidAmount = salaries.filter((s) => s.status === 'PAID').reduce((acc, s) => acc + s.netPaid, 0);

    return res.json({
      month: m,
      year: y,
      totalEmployees: salaries.length,
      totalPayout,
      paidAmount,
      pendingAmount: totalPayout - paidAmount,
      salaries,
    });
  } catch (error: any) {
    console.error('Error in listSalaries:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function generateSalaries(req: AuthRequest, res: Response) {
  try {
    const { month, year } = req.body;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    const activeEmployees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
    });

    const generated = [];

    for (const emp of activeEmployees) {
      const prevSalary = await prisma.salary.findFirst({
        where: { employeeId: emp.id },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });

      const baseSalary = prevSalary?.baseSalary || 18000;

      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 0, 23, 59, 59);

      const absences = await prisma.attendance.count({
        where: {
          employeeId: emp.id,
          date: { gte: startDate, lte: endDate },
          status: 'ABSENT',
        },
      });

      const dailyRate = Math.round(baseSalary / 30);
      const deductions = absences * dailyRate;
      const netPaid = Math.max(0, baseSalary - deductions);

      const salaryRecord = await prisma.salary.upsert({
        where: {
          employeeId_month_year: {
            employeeId: emp.id,
            month: m,
            year: y,
          },
        },
        update: {
          baseSalary,
          deductions,
          netPaid,
        },
        create: {
          employeeId: emp.id,
          month: m,
          year: y,
          baseSalary,
          deductions,
          bonuses: 0,
          netPaid,
          status: 'PENDING',
        },
      });

      generated.push(salaryRecord);
    }

    return res.json({ message: `Generated payroll for ${generated.length} employees`, count: generated.length });
  } catch (error: any) {
    console.error('Error in generateSalaries:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markSalaryPaid(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { bonuses, deductions } = req.body ?? {};

    const salary = await prisma.salary.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!salary) return res.status(404).json({ error: 'Salary record not found' });

    const finalBonuses = typeof bonuses === 'number' ? bonuses : salary.bonuses;
    const finalDeductions = typeof deductions === 'number' ? deductions : salary.deductions;
    const netPaid = salary.baseSalary + finalBonuses - finalDeductions;

    const updated = await prisma.salary.update({
      where: { id },
      data: {
        bonuses: finalBonuses,
        deductions: finalDeductions,
        netPaid,
        status: 'PAID',
        paidOn: new Date(),
      },
    });

    await prisma.expense.create({
      data: {
        hubId: salary.employee.hubId,
        category: 'SALARY',
        amount: netPaid,
        date: new Date(),
        note: `Salary payout for ${salary.employee.name} (${salary.month}/${salary.year})`,
      },
    }).catch(() => {});

    return res.json({ message: 'Salary marked as paid and logged to expenses', salary: updated });
  } catch (error: any) {
    console.error('Error in markSalaryPaid:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function exportSalariesCsv(req: AuthRequest, res: Response) {
  try {
    const { month, year } = req.query;
    const m = month ? parseInt(String(month), 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(String(year), 10) : new Date().getFullYear();

    const salaries = await prisma.salary.findMany({
      where: { month: m, year: y },
      include: {
        employee: {
          include: { hub: true },
        },
      },
      orderBy: [{ employee: { name: 'asc' } }],
    });

    const headers = 'Employee ID,Name,Phone,Role,Hub,Month,Year,Base Salary,Deductions,Bonuses,Net Pay,Status,Paid On\n';
    const rows = salaries.map((s) => {
      const e = s.employee;
      const hubName = e.hub?.name ? `"${e.hub.name.replace(/"/g, '""')}"` : 'Unassigned';
      const paidDate = s.paidOn ? s.paidOn.toISOString().split('T')[0] : '';
      return `${e.id},"${e.name.replace(/"/g, '""')}",${e.phone},${e.role},${hubName},${s.month},${s.year},${s.baseSalary},${s.deductions},${s.bonuses},${s.netPaid},${s.status},${paidDate}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payroll_${y}_${m}.csv`);
    return res.send(headers + rows);
  } catch (error: any) {
    console.error('Error in exportSalariesCsv:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
