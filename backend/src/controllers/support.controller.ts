import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

function generateSupportTicketNumber(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `TKT-${randomNum}`;
}

/* =========================================================================
   RIDER ENDPOINTS
   ========================================================================= */

export async function listMyTickets(req: AuthRequest, res: Response) {
  try {
    const riderId = req.user?.id;
    if (!riderId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { riderId },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            model: { select: { name: true } },
          },
        },
      },
    });

    return res.json({ success: true, data: tickets });
  } catch (error: any) {
    console.error('listMyTickets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
}

export async function createTicket(req: AuthRequest, res: Response) {
  try {
    const riderId = req.user?.id;
    if (!riderId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { category, subject, description, attachmentUrl, bookingId } = req.body;

    if (!category || !description) {
      return res.status(400).json({
        success: false,
        message: 'Category and description are required',
      });
    }

    const ticketNumber = generateSupportTicketNumber();

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        riderId,
        bookingId: bookingId || null,
        category,
        subject: subject || null,
        description,
        status: 'OPEN',
        attachmentUrl: attachmentUrl || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: ticket,
      message: `Support ticket ${ticketNumber} created successfully`,
    });
  } catch (error: any) {
    console.error('createTicket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create support ticket' });
  }
}

export async function getMyTicketDetail(req: AuthRequest, res: Response) {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, riderId },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            model: { select: { name: true } },
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    return res.json({ success: true, data: ticket });
  } catch (error: any) {
    console.error('getMyTicketDetail error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch ticket' });
  }
}

/* =========================================================================
   ADMIN / HELPDESK ENDPOINTS
   ========================================================================= */

export async function listAllTickets(req: AuthRequest, res: Response) {
  try {
    const { status, category, riderId, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (status) where.status = status as any;
    if (category) where.category = category as any;
    if (riderId) where.riderId = riderId as string;

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const take = parseInt(limit as string, 10);

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          rider: { select: { id: true, fullName: true, phone: true, email: true } },
          booking: {
            select: {
              id: true,
              reference: true,
              status: true,
              model: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.supportTicket.count({ where }),
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
    console.error('listAllTickets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list support tickets' });
  }
}

export async function getAdminTicketDetail(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        rider: true,
        booking: {
          include: {
            model: true,
            plan: true,
            hub: true,
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    return res.json({ success: true, data: ticket });
  } catch (error: any) {
    console.error('getAdminTicketDetail error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch ticket' });
  }
}

export async function updateAdminTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    if ((status === 'RESOLVED' || status === 'CLOSED') && !existing.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: updateData,
      include: {
        rider: { select: { id: true, fullName: true, phone: true } },
      },
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Ticket updated successfully',
    });
  } catch (error: any) {
    console.error('updateAdminTicket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update ticket' });
  }
}
