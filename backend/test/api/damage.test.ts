/**
 * Module: Damage & Penalty (DAM-001 .. DAM-013)
 * Endpoints: POST /admin/api/rentals/:id/damage, GET /admin/api/damage,
 *            POST /admin/api/damage/:id/resolve
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, makeActiveRental } from '../helpers/factories';

describe('Damage & Penalty', () => {
  it('DAM-001..008 an Executive logs a damage report linked to the right rental and bike', async () => {
    const { headers, user } = await actingAs('EXECUTIVE');
    const { rental, bike, booking } = await makeActiveRental();

    const res = await api()
      .post(`/admin/api/rentals/${rental.id}/damage`)
      .set(headers)
      .send({
        severity: 'MAJOR',
        description: 'Front fork bent',
        estimatedCost: 4500,
        photoKeys: ['damage/1.jpg', 'damage/2.jpg'],
      });

    expect(res.status).toBe(201);
    const report = await prisma.damageReport.findFirstOrThrow({ where: { rentalId: rental.id } });
    expect(report).toMatchObject({
      bikeId: bike.id,
      reportedById: user.id,
      severity: 'MAJOR',
      description: 'Front fork bent',
      estimatedCost: 4500,
      chargeStatus: 'PENDING',
    });
    expect(report.photoKeys).toEqual(['damage/1.jpg', 'damage/2.jpg']);

    // linked to the correct booking via the rental
    const r = await prisma.rental.findUniqueOrThrow({ where: { id: report.rentalId } });
    expect(r.bookingId).toBe(booking.id);
  });

  it('DAM-002 severity and description are mandatory', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const { rental } = await makeActiveRental();
    const res = await api().post(`/admin/api/rentals/${rental.id}/damage`).set(headers).send({ severity: 'MINOR' });
    expect(res.status).toBe(400);
  });

  it('DAM-006/011/012 resolving as CHARGE raises a DAMAGE payment for the final cost', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental } = await makeActiveRental();
    const report = await prisma.damageReport.create({
      data: { rentalId: rental.id, bikeId: rental.bikeId, severity: 'MODERATE', description: 'dent', estimatedCost: 1200 },
    });

    const res = await api()
      .post(`/admin/api/damage/${report.id}/resolve`)
      .set(headers)
      .send({ action: 'CHARGE', finalCost: 1500 });
    expect(res.status).toBe(200);

    const updated = await prisma.damageReport.findUniqueOrThrow({ where: { id: report.id } });
    expect(updated.chargeStatus).toBe('CHARGED');
    expect(updated.estimatedCost).toBe(1500);

    const payment = await prisma.payment.findFirstOrThrow({ where: { purpose: 'DAMAGE' } });
    expect(payment).toMatchObject({ amount: 1500, status: 'INITIATED', userId: rental.userId });
  });

  it('DAM-011b resolving as WAIVE closes the report with no charge', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental } = await makeActiveRental();
    const report = await prisma.damageReport.create({
      data: { rentalId: rental.id, bikeId: rental.bikeId, severity: 'MINOR', description: 'scuff', estimatedCost: 300 },
    });

    const res = await api().post(`/admin/api/damage/${report.id}/resolve`).set(headers).send({ action: 'WAIVE' });
    expect(res.status).toBe(200);
    expect((await prisma.damageReport.findUniqueOrThrow({ where: { id: report.id } })).chargeStatus).toBe('WAIVED');
    expect(await prisma.payment.count({ where: { purpose: 'DAMAGE' } })).toBe(0);
  });

  it('DAM a report can only be resolved once', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental } = await makeActiveRental();
    const report = await prisma.damageReport.create({
      data: { rentalId: rental.id, bikeId: rental.bikeId, severity: 'MINOR', description: 'x', estimatedCost: 100 },
    });
    await api().post(`/admin/api/damage/${report.id}/resolve`).set(headers).send({ action: 'WAIVE' });
    const again = await api().post(`/admin/api/damage/${report.id}/resolve`).set(headers).send({ action: 'CHARGE' });
    expect(again.status).toBe(409);
  });

  it('DAM resolve rejects an invalid action', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental } = await makeActiveRental();
    const report = await prisma.damageReport.create({
      data: { rentalId: rental.id, bikeId: rental.bikeId, severity: 'MINOR', description: 'x' },
    });
    const res = await api().post(`/admin/api/damage/${report.id}/resolve`).set(headers).send({ action: 'DELETE' });
    expect(res.status).toBe(400);
  });

  it('DAM-012 filters the damage list by charge status', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental } = await makeActiveRental();
    await prisma.damageReport.create({ data: { rentalId: rental.id, bikeId: rental.bikeId, severity: 'MINOR', description: 'a', chargeStatus: 'PENDING' } });
    await prisma.damageReport.create({ data: { rentalId: rental.id, bikeId: rental.bikeId, severity: 'MAJOR', description: 'b', chargeStatus: 'CHARGED' } });

    const res = await api().get('/admin/api/damage').query({ chargeStatus: 'PENDING' }).set(headers);
    expect(res.body.count).toBe(1);
    expect(res.body.reports[0].description).toBe('a');
  });

  it.failing(
    'DAM-009 damage should not be loggable against a COMPLETED (closed) rental (GAP: logDamage does not check rental.status)',
    async () => {
      const { headers } = await actingAs('EXECUTIVE');
      const { rental } = await makeActiveRental();
      await prisma.rental.update({ where: { id: rental.id }, data: { status: 'COMPLETED', closedAt: new Date() } });

      const res = await api()
        .post(`/admin/api/rentals/${rental.id}/damage`)
        .set(headers)
        .send({ severity: 'MAJOR', description: 'post-closure claim', estimatedCost: 5000 });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  );

  it.skip('DAM-010 edit damage report — no update endpoint exists', () => {});
});
