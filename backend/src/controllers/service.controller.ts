import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

/* =========================================================================
   SERVICE PERSONS / TECHNICIANS
   ========================================================================= */

export async function listServicePersons(req: AuthRequest, res: Response) {
  try {
    const { hubId, status } = req.query;
    const where: any = {};
    if (hubId) where.hubId = hubId as string;
    if (status) where.status = status as string;

    const persons = await prisma.servicePerson.findMany({
      where,
      include: {
        hub: { select: { id: true, name: true, city: true } },
        tickets: {
          where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
          select: { id: true, status: true, reportedIssue: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = persons.map((p) => ({
      ...p,
      activeTicketCount: p.tickets.length,
    }));

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('listServicePersons error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list service personnel' });
  }
}

export async function createServicePerson(req: AuthRequest, res: Response) {
  try {
    const { name, phone, specialization, hubId, status = 'AVAILABLE' } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    const person = await prisma.servicePerson.create({
      data: {
        name,
        phone,
        specialization: specialization || null,
        hubId: hubId || null,
        status,
      },
      include: {
        hub: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({ success: true, data: person });
  } catch (error: any) {
    console.error('createServicePerson error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create service person' });
  }
}

export async function updateServicePerson(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, phone, specialization, hubId, status } = req.body;

    const person = await prisma.servicePerson.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        phone: phone !== undefined ? phone : undefined,
        specialization: specialization !== undefined ? specialization : undefined,
        hubId: hubId !== undefined ? hubId : undefined,
        status: status !== undefined ? status : undefined,
      },
      include: {
        hub: { select: { id: true, name: true } },
      },
    });

    return res.json({ success: true, data: person });
  } catch (error: any) {
    console.error('updateServicePerson error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update service person' });
  }
}

/* =========================================================================
   SERVICE TICKETS
   ========================================================================= */

export async function listServiceTickets(req: AuthRequest, res: Response) {
  try {
    const { status, bikeId, assignedServicePersonId, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (status) where.status = status as any;
    if (bikeId) where.bikeId = bikeId as string;
    if (assignedServicePersonId) where.assignedServicePersonId = assignedServicePersonId as string;

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const take = parseInt(limit as string, 10);

    const [tickets, total] = await Promise.all([
      prisma.serviceTicket.findMany({
        where,
        include: {
          bike: {
            select: {
              id: true,
              registrationNumber: true,
              status: true,
              hubId: true,
              model: { select: { name: true } },
            },
          },
          assignedServicePerson: { select: { id: true, name: true, phone: true } },
          parts: true,
          notes: {
            orderBy: { addedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.serviceTicket.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        tickets,
        total,
        page: parseInt(page as string, 10),
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error('listServiceTickets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list service tickets' });
  }
}

export async function getServiceTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const ticket = await prisma.serviceTicket.findUnique({
      where: { id },
      include: {
        bike: {
          include: {
            model: true,
            hub: true,
          },
        },
        assignedServicePerson: true,
        parts: true,
        notes: {
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Service ticket not found' });
    }

    return res.json({ success: true, data: ticket });
  } catch (error: any) {
    console.error('getServiceTicket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch service ticket' });
  }
}

export async function createServiceTicket(req: AuthRequest, res: Response) {
  try {
    const {
      bikeId,
      reportedIssue,
      assignedServicePersonId,
      scheduledTime,
      note,
    } = req.body;

    if (!bikeId || !reportedIssue) {
      return res.status(400).json({ success: false, message: 'bikeId and reportedIssue are required' });
    }

    const ticket = await prisma.serviceTicket.create({
      data: {
        bikeId,
        reportedIssue,
        assignedServicePersonId: assignedServicePersonId || null,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        status: assignedServicePersonId ? 'ASSIGNED' : 'ASSIGNED',
        totalCost: 0,
      },
      include: {
        bike: true,
        assignedServicePerson: true,
      },
    });

    // Mark bike status as MAINTENANCE
    await prisma.bike.update({
      where: { id: bikeId },
      data: { status: 'MAINTENANCE' },
    });

    if (note) {
      await prisma.serviceNote.create({
        data: {
          serviceTicketId: ticket.id,
          note,
        },
      });
    }

    return res.status(201).json({ success: true, data: ticket, message: 'Service ticket created' });
  } catch (error: any) {
    console.error('createServiceTicket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create service ticket' });
  }
}

export async function addServicePart(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params; // serviceTicketId
    const { partName, cost, quantity = 1 } = req.body;

    if (!partName || cost === undefined) {
      return res.status(400).json({ success: false, message: 'partName and cost are required' });
    }

    const part = await prisma.servicePart.create({
      data: {
        serviceTicketId: id,
        partName,
        cost: Math.round(parseFloat(cost)),
        quantity: parseInt(quantity, 10) || 1,
      },
    });

    // Recalculate ticket totalCost
    const allParts = await prisma.servicePart.findMany({ where: { serviceTicketId: id } });
    const partsTotal = allParts.reduce((acc, p) => acc + (p.cost * p.quantity), 0);

    await prisma.serviceTicket.update({
      where: { id },
      data: {
        totalCost: partsTotal,
      },
    });

    return res.status(201).json({ success: true, data: part });
  } catch (error: any) {
    console.error('addServicePart error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add service part' });
  }
}

export async function addServiceNote(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params; // serviceTicketId
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ success: false, message: 'note text is required' });
    }

    const serviceNote = await prisma.serviceNote.create({
      data: {
        serviceTicketId: id,
        note,
      },
    });

    return res.status(201).json({ success: true, data: serviceNote });
  } catch (error: any) {
    console.error('addServiceNote error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add note' });
  }
}

export async function updateServiceTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, assignedServicePersonId, totalTimeTakenMinutes, totalCost, note } = req.body;

    const existingTicket = await prisma.serviceTicket.findUnique({
      where: { id },
      include: { bike: true, parts: true },
    });

    if (!existingTicket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (assignedServicePersonId !== undefined) updateData.assignedServicePersonId = assignedServicePersonId;
    if (totalTimeTakenMinutes !== undefined) updateData.totalTimeTakenMinutes = parseInt(totalTimeTakenMinutes, 10);
    if (totalCost !== undefined) updateData.totalCost = Math.round(parseFloat(totalCost));

    if (status === 'IN_PROGRESS' && !existingTicket.startedAt) {
      updateData.startedAt = new Date();
    }

    // If marked COMPLETED
    if (status === 'COMPLETED' && existingTicket.status !== 'COMPLETED') {
      updateData.completedAt = new Date();

      // Set bike back to AVAILABLE
      await prisma.bike.update({
        where: { id: existingTicket.bikeId },
        data: { status: 'AVAILABLE' },
      });

      // Auto-log to Expenses under SERVICE category
      const partsTotal = existingTicket.parts.reduce((acc, p) => acc + (p.cost * p.quantity), 0);
      const finalCost = totalCost !== undefined ? Math.round(parseFloat(totalCost)) : Math.max(partsTotal, existingTicket.totalCost);

      if (finalCost > 0) {
        await prisma.expense.create({
          data: {
            category: 'SERVICE',
            amount: finalCost,
            note: `Service Ticket for Bike (${existingTicket.bike.registrationNumber}) - Issue: ${existingTicket.reportedIssue}`,
            hubId: existingTicket.bike.hubId || null,
            date: new Date(),
          },
        });
      }
    }

    const updated = await prisma.serviceTicket.update({
      where: { id },
      data: updateData,
      include: {
        bike: true,
        assignedServicePerson: true,
        parts: true,
        notes: true,
      },
    });

    if (note) {
      await prisma.serviceNote.create({
        data: {
          serviceTicketId: id,
          note,
        },
      });
    }

    return res.json({ success: true, data: updated, message: 'Ticket updated successfully' });
  } catch (error: any) {
    console.error('updateServiceTicket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update ticket' });
  }
}
