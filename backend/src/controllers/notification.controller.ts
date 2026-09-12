import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * The rider's in-app inbox.
 *
 * Rows are written by utils/notifications.ts alongside every push, so this
 * list is complete even for riders who denied notification permission.
 */

/** GET /user/notifications?unreadOnly=true&limit=50 */
export async function listMyNotifications(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 100);
    const unreadOnly = String(req.query.unreadOnly) === 'true';

    const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error: any) {
    console.error('listMyNotifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
}

/**
 * GET /user/notifications/unread-count
 *
 * Cheap enough for the app to poll on every screen focus — it is what drives
 * the badge on the bottom bar.
 */
export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
    return res.json({ success: true, data: { unreadCount } });
  } catch (error: any) {
    console.error('getUnreadCount error:', error);
    return res.status(500).json({ success: false, message: 'Failed to count notifications' });
  }
}

/** POST /user/notifications/:id/read */
export async function markNotificationRead(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    // updateMany scopes the write to the owner, so one rider cannot mark
    // another rider's row read by guessing an id.
    const result = await prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      const exists = await prisma.notification.findFirst({ where: { id, userId } });
      if (!exists) return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
    return res.json({ success: true, data: { unreadCount } });
  } catch (error: any) {
    console.error('markNotificationRead error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
}

/** POST /user/notifications/read-all */
export async function markAllNotificationsRead(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return res.json({ success: true, data: { marked: result.count, unreadCount: 0 } });
  } catch (error: any) {
    console.error('markAllNotificationsRead error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
}
