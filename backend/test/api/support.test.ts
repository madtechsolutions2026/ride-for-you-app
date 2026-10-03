/**
 * Module: Support conversation & notification inbox (SUP / NOT)
 * Endpoints: GET+POST /support/:id/messages,
 *            GET+POST /admin/api/support/tickets/:id/messages,
 *            GET /user/notifications[...]
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, bearer, makeUser } from '../helpers/factories';

async function makeTicket(riderId: string, overrides: Partial<{ status: string }> = {}) {
  return prisma.supportTicket.create({
    data: {
      ticketNumber: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      riderId,
      category: 'BIKE_ISSUE',
      subject: 'Brake feels loose',
      description: 'The rear brake needs a hard squeeze before it bites.',
      status: overrides.status ?? 'OPEN',
    },
  });
}

describe('Support conversation thread', () => {
  it('SUP-001 starts with an empty thread — the description is the opening message', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(rider.id);

    const res = await api()
      .get(`/support/${ticket.id}/messages`)
      .set(bearer(rider.id, 'RIDER'));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('SUP-002 a rider reply appears in the thread', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(rider.id);

    const post = await api()
      .post(`/support/${ticket.id}/messages`)
      .set(bearer(rider.id, 'RIDER'))
      .field('body', 'It got worse this morning.');

    expect(post.status).toBe(201);
    expect(post.body.data.authorType).toBe('RIDER');

    const thread = await api()
      .get(`/support/${ticket.id}/messages`)
      .set(bearer(rider.id, 'RIDER'));
    expect(thread.body.data).toHaveLength(1);
    expect(thread.body.data[0].body).toBe('It got worse this morning.');
  });

  it('SUP-003 an empty reply with no attachment is rejected', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(rider.id);

    const res = await api()
      .post(`/support/${ticket.id}/messages`)
      .set(bearer(rider.id, 'RIDER'))
      .field('body', '   ');

    expect(res.status).toBe(400);
  });

  it('SUP-004 one rider cannot read or post on another rider’s ticket', async () => {
    const owner = await makeUser({ role: 'RIDER' });
    const stranger = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(owner.id);

    const read = await api()
      .get(`/support/${ticket.id}/messages`)
      .set(bearer(stranger.id, 'RIDER'));
    expect(read.status).toBe(404);

    const write = await api()
      .post(`/support/${ticket.id}/messages`)
      .set(bearer(stranger.id, 'RIDER'))
      .field('body', 'Let me in');
    expect(write.status).toBe(404);
  });

  it('SUP-005 an agent reply moves an OPEN ticket to IN_PROGRESS', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(rider.id);
    const { headers } = await actingAs('SUPPORT');

    const res = await api()
      .post(`/admin/api/support/tickets/${ticket.id}/messages`)
      .set(headers)
      .send({ body: 'Bring it to the hub and we will adjust the cable.' });

    expect(res.status).toBe(201);
    expect(res.body.data.authorType).toBe('AGENT');

    const row = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.status).toBe('IN_PROGRESS');
  });

  it('SUP-006 an agent can answer and resolve in one call', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(rider.id);
    const { headers } = await actingAs('SUPPORT');

    const res = await api()
      .post(`/admin/api/support/tickets/${ticket.id}/messages`)
      .set(headers)
      .send({ body: 'Cable tightened at the hub today.', status: 'RESOLVED' });

    expect(res.status).toBe(201);

    const row = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.status).toBe('RESOLVED');
    expect(row.resolvedAt).toBeInstanceOf(Date);
  });

  it('SUP-007 a rider replying to a resolved ticket reopens it', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(rider.id, { status: 'RESOLVED' });
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { resolvedAt: new Date() },
    });

    const res = await api()
      .post(`/support/${ticket.id}/messages`)
      .set(bearer(rider.id, 'RIDER'))
      .field('body', 'It is still happening.');

    expect(res.status).toBe(201);
    expect(res.body.reopened).toBe(true);

    const row = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.status).toBe('OPEN');
    expect(row.resolvedAt).toBeNull();
  });

  it('SUP-008 both sides read the same thread in chat order', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(rider.id);
    const { headers } = await actingAs('SUPPORT');

    await api()
      .post(`/support/${ticket.id}/messages`)
      .set(bearer(rider.id, 'RIDER'))
      .field('body', 'First from rider');
    await api()
      .post(`/admin/api/support/tickets/${ticket.id}/messages`)
      .set(headers)
      .send({ body: 'Then from agent' });

    const riderView = await api()
      .get(`/support/${ticket.id}/messages`)
      .set(bearer(rider.id, 'RIDER'));
    const agentView = await api()
      .get(`/admin/api/support/tickets/${ticket.id}/messages`)
      .set(headers);

    expect(riderView.body.data.map((m: any) => m.body)).toEqual([
      'First from rider',
      'Then from agent',
    ]);
    expect(agentView.body.data.map((m: any) => m.body)).toEqual(
      riderView.body.data.map((m: any) => m.body),
    );
  });

  it('SUP-009 the ticket list carries a reply count', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(rider.id);
    await api()
      .post(`/support/${ticket.id}/messages`)
      .set(bearer(rider.id, 'RIDER'))
      .field('body', 'Any update?');

    const res = await api().get('/support').set(bearer(rider.id, 'RIDER'));

    expect(res.status).toBe(200);
    const mine = res.body.data.find((t: any) => t.id === ticket.id);
    expect(mine._count.messages).toBe(1);
  });
});

describe('Notification inbox', () => {
  async function seedNotification(userId: string, overrides: Partial<{ readAt: Date }> = {}) {
    return prisma.notification.create({
      data: {
        userId,
        category: 'PAYMENT',
        title: 'Rent due tomorrow',
        body: '₹1,645 for week 2. Tap to pay.',
        screen: 'MyRental',
        readAt: overrides.readAt ?? null,
      },
    });
  }

  it('NOT-001 lists a rider’s own notifications with an unread count', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    await seedNotification(rider.id);
    await seedNotification(rider.id, { readAt: new Date() });

    const res = await api().get('/user/notifications').set(bearer(rider.id, 'RIDER'));

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(2);
    expect(res.body.data.unreadCount).toBe(1);
  });

  it('NOT-002 never leaks another rider’s notifications', async () => {
    const mine = await makeUser({ role: 'RIDER' });
    const theirs = await makeUser({ role: 'RIDER' });
    await seedNotification(theirs.id);

    const res = await api().get('/user/notifications').set(bearer(mine.id, 'RIDER'));

    expect(res.body.data.notifications).toEqual([]);
    expect(res.body.data.unreadCount).toBe(0);
  });

  it('NOT-003 unreadOnly filters out what has been read', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    await seedNotification(rider.id);
    await seedNotification(rider.id, { readAt: new Date() });

    const res = await api()
      .get('/user/notifications?unreadOnly=true')
      .set(bearer(rider.id, 'RIDER'));

    expect(res.body.data.notifications).toHaveLength(1);
  });

  it('NOT-004 marks one read and returns the new badge count', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const first = await seedNotification(rider.id);
    await seedNotification(rider.id);

    const res = await api()
      .post(`/user/notifications/${first.id}/read`)
      .set(bearer(rider.id, 'RIDER'))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(1);

    const row = await prisma.notification.findUniqueOrThrow({ where: { id: first.id } });
    expect(row.readAt).toBeInstanceOf(Date);
  });

  it('NOT-005 cannot mark someone else’s notification read', async () => {
    const mine = await makeUser({ role: 'RIDER' });
    const theirs = await makeUser({ role: 'RIDER' });
    const foreign = await seedNotification(theirs.id);

    const res = await api()
      .post(`/user/notifications/${foreign.id}/read`)
      .set(bearer(mine.id, 'RIDER'))
      .send({});

    expect(res.status).toBe(404);
    const row = await prisma.notification.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(row.readAt).toBeNull();
  });

  it('NOT-006 read-all clears the badge', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    await seedNotification(rider.id);
    await seedNotification(rider.id);

    const res = await api()
      .post('/user/notifications/read-all')
      .set(bearer(rider.id, 'RIDER'))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.marked).toBe(2);

    const count = await api()
      .get('/user/notifications/unread-count')
      .set(bearer(rider.id, 'RIDER'));
    expect(count.body.data.unreadCount).toBe(0);
  });

  it('NOT-007 an agent reply writes a SUPPORT notification for the rider', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const ticket = await makeTicket(rider.id);
    const { headers } = await actingAs('SUPPORT');

    await api()
      .post(`/admin/api/support/tickets/${ticket.id}/messages`)
      .set(headers)
      .send({ body: 'Looking into it now.' });

    // The inbox write is awaited inside deliver(), but the push that follows is
    // fire-and-forget, so give the event loop a tick to settle.
    await new Promise((r) => setTimeout(r, 100));

    const row = await prisma.notification.findFirst({
      where: { userId: rider.id, category: 'SUPPORT' },
    });
    expect(row).toBeTruthy();
    expect(row!.screen).toBe('TicketDetail');
    expect((row!.params as any)?.ticketId).toBe(ticket.id);
  });
});
