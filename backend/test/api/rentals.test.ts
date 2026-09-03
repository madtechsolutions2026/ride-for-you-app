/**
 * Module: Return & Rental Closure (RET-001 .. RET-012)
 * Endpoints: POST /admin/api/rentals/:id/return, POST /admin/api/rentals/:id/close,
 *            POST /admin/api/rentals/:id/damage, GET /admin/api/rentals
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, makeActiveRental } from '../helpers/factories';

describe('Return & Rental Closure', () => {
  it('RET-001/002/004/006 returns a bike, records the odometer, frees the bike', async () => {
    const { headers, user } = await actingAs('EXECUTIVE');
    const { rental, bike } = await makeActiveRental();

    const res = await api()
      .post(`/admin/api/rentals/${rental.id}/return`)
      .set(headers)
      .send({ odometerEnd: 3456 });

    expect(res.status).toBe(200);
    const row = await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } });
    expect(row.status).toBe('RETURNED');
    expect(row.returnedAt).toBeInstanceOf(Date);
    expect(row.returnById).toBe(user.id);
    expect(row.odometerEnd).toBe(3456);

    const b = await prisma.bike.findUniqueOrThrow({ where: { id: bike.id } });
    expect(b.status).toBe('AVAILABLE');
    expect(b.odometerKm).toBe(3456);
  });

  it('RET-005/011/012 closes a returned rental once nothing is outstanding', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental, invoice } = await makeActiveRental();
    await prisma.weeklyInvoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date() } });
    await api().post(`/admin/api/rentals/${rental.id}/return`).set(headers).send({ odometerEnd: 10 });

    const res = await api().post(`/admin/api/rentals/${rental.id}/close`).set(headers).send({});
    expect(res.status).toBe(200);
    const row = await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } });
    expect(row.status).toBe('COMPLETED');
    expect(row.closedAt).toBeInstanceOf(Date);
  });

  it('RET-010 a rental cannot be closed before it is returned', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental } = await makeActiveRental();
    const res = await api().post(`/admin/api/rentals/${rental.id}/close`).set(headers).send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/must be RETURNED/i);
  });

  it('RET-008 closure is blocked while a weekly invoice is still unpaid', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental } = await makeActiveRental({ weekInvoiceStatus: 'PENDING' });
    await api().post(`/admin/api/rentals/${rental.id}/return`).set(headers).send({ odometerEnd: 5 });

    const res = await api().post(`/admin/api/rentals/${rental.id}/close`).set(headers).send({});
    expect(res.status).toBe(409);
    expect(res.body.unpaidInvoices).toBe(1);
  });

  it('RET-003/010b closure is blocked while a damage charge is still pending', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const { rental, invoice } = await makeActiveRental();
    await prisma.weeklyInvoice.update({ where: { id: invoice.id }, data: { status: 'PAID' } });
    await api().post(`/admin/api/rentals/${rental.id}/return`).set(headers).send({ odometerEnd: 5 });

    // RET-003: log damage found during the return inspection
    const dmg = await api()
      .post(`/admin/api/rentals/${rental.id}/damage`)
      .set(headers)
      .send({ severity: 'MODERATE', description: 'Cracked headlight', estimatedCost: 900 });
    expect(dmg.status).toBe(201);

    const close = await api().post(`/admin/api/rentals/${rental.id}/close`).set(headers).send({});
    expect(close.status).toBe(409);
    expect(close.body.pendingDamage).toBe(1);
  });

  it('RET returning an already-returned rental is refused', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const { rental } = await makeActiveRental();
    await api().post(`/admin/api/rentals/${rental.id}/return`).set(headers).send({});
    const again = await api().post(`/admin/api/rentals/${rental.id}/return`).set(headers).send({});
    expect(again.status).toBe(409);
  });

  it('RET listRentals flags an overdue active rental', async () => {
    const { headers } = await actingAs('ADMIN');
    await makeActiveRental({ expectedReturnAt: new Date(Date.now() - 2 * 86400_000) });
    const res = await api().get('/admin/api/rentals').query({ status: 'ACTIVE' }).set(headers);
    expect(res.body.rentals[0].isOverdue).toBe(true);
  });

  it.skip('RET-007/009 final charge & deposit/refund calculation — closeRental settles state only, it does not compute a final bill', () => {});
});
