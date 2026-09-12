import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { notify } from '../utils/notifications';
import { presignGet } from '../utils/r2';
import { putImage } from '../utils/uploads';

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
        // Drives the "2 replies" line on each row in the app's ticket list.
        _count: { select: { messages: true } },
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

/* =========================================================================
   CONVERSATION THREAD

   The ticket's own `description` is the opening message; everything after it
   is a SupportMessage. Both sides post into the same thread, so the rider
   sees exactly what the agent wrote and vice versa.
   ========================================================================= */

/** Presign every attachment on a list of messages, in one pass. */
async function withAttachmentUrls(messages: any[]) {
  return Promise.all(
    messages.map(async (m) => ({
      ...m,
      attachmentUrl: m.attachmentKey ? await presignGet(m.attachmentKey) : null,
    })),
  );
}

/** GET /support/:id/messages — the thread, oldest first (chat order). */
export async function listTicketMessages(req: AuthRequest, res: Response) {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, riderId },
      select: { id: true },
    });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const messages = await prisma.supportMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });

    return res.json({ success: true, data: await withAttachmentUrls(messages) });
  } catch (error: any) {
    console.error('listTicketMessages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load the conversation' });
  }
}

/**
 * POST /support/:id/messages  (multipart: optional `file`)
 * Body: { body }
 *
 * A reply on a RESOLVED or CLOSED ticket reopens it — the rider telling us
 * the problem is still there is the clearest possible signal that it is.
 */
export async function postRiderMessage(req: AuthRequest, res: Response) {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;
    const body = String(req.body?.body || '').trim();

    if (!body && !(req as any).file) {
      return res.status(400).json({ success: false, message: 'Write a message or attach a photo' });
    }

    const ticket = await prisma.supportTicket.findFirst({ where: { id, riderId } });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    let attachmentKey: string | null = null;
    if ((req as any).file) {
      attachmentKey = await putImage('support', riderId!, (req as any).file);
    }

    const [message] = await prisma.$transaction([
      prisma.supportMessage.create({
        data: {
          ticketId: id,
          authorType: 'RIDER',
          authorId: riderId!,
          body: body.slice(0, 2000),
          attachmentKey,
        },
        include: { author: { select: { id: true, fullName: true, role: true } } },
      }),
      prisma.supportTicket.update({
        where: { id },
        data:
          ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
            ? { status: 'OPEN', resolvedAt: null }
            : { updatedAt: new Date() },
      }),
    ]);

    const reopened = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

    return res.status(201).json({
      success: true,
      data: (await withAttachmentUrls([message]))[0],
      reopened,
      message: reopened ? 'Ticket reopened and your reply sent' : 'Reply sent',
    });
  } catch (error: any) {
    const status = error?.status ?? 500;
    console.error('postRiderMessage error:', error);
    return res
      .status(status)
      .json({ success: false, message: status === 500 ? 'Failed to send the reply' : error.message });
  }
}

/** GET /admin/api/support/tickets/:id/messages — same thread, agent side. */
export async function listAdminTicketMessages(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const messages = await prisma.supportMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });

    return res.json({ success: true, data: await withAttachmentUrls(messages) });
  } catch (error: any) {
    console.error('listAdminTicketMessages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load the conversation' });
  }
}

/**
 * POST /admin/api/support/tickets/:id/messages
 * Body: { body, status? }
 *
 * The agent's reply, optionally moving the ticket's status in the same call
 * so "answer and resolve" is one action rather than two.
 */
export async function postAgentMessage(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = String(req.body?.body || '').trim();
    const nextStatus = req.body?.status ? String(req.body.status).toUpperCase() : null;

    if (!body) {
      return res.status(400).json({ success: false, message: 'A reply cannot be empty' });
    }
    if (nextStatus && !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const statusData: any = {};
    if (nextStatus) {
      statusData.status = nextStatus;
      if ((nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') && !ticket.resolvedAt) {
        statusData.resolvedAt = new Date();
      }
      if (nextStatus === 'OPEN' || nextStatus === 'IN_PROGRESS') {
        statusData.resolvedAt = null;
      }
    } else if (ticket.status === 'OPEN') {
      // An agent who answers has, by definition, picked the ticket up.
      statusData.status = 'IN_PROGRESS';
    }

    const [message] = await prisma.$transaction([
      prisma.supportMessage.create({
        data: {
          ticketId: id,
          authorType: 'AGENT',
          authorId: req.user?.id ?? null,
          body: body.slice(0, 2000),
        },
        include: { author: { select: { id: true, fullName: true, role: true } } },
      }),
      prisma.supportTicket.update({ where: { id }, data: statusData }),
    ]);

    const resolved = statusData.status === 'RESOLVED' || statusData.status === 'CLOSED';
    void (resolved
      ? notify.ticketResolved(ticket.riderId, ticket.id, ticket.ticketNumber)
      : notify.supportReplied(ticket.riderId, ticket.id, ticket.ticketNumber));

    return res.status(201).json({
      success: true,
      data: message,
      message: resolved ? 'Reply sent and ticket closed' : 'Reply sent to the rider',
    });
  } catch (error: any) {
    console.error('postAgentMessage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send the reply' });
  }
}
