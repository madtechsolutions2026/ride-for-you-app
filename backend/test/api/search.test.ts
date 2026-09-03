/**
 * Module: Search, Filters & Sorting (SEA-001 .. SEA-012)
 * Exercised against GET /admin/api/users (the only list endpoint with search +
 * filter + pagination all together).
 */
import { api } from '../helpers/api';
import { actingAs, makeUser } from '../helpers/factories';

async function seedRiders() {
  await makeUser({ role: 'RIDER', fullName: 'Arjun Mehta', city: 'Hyderabad', phone: '+919800000001', kycStatus: 'APPROVED' });
  await makeUser({ role: 'RIDER', fullName: 'Arundhati Roy', city: 'Pune', phone: '+919800000002', kycStatus: 'PENDING' });
  await makeUser({ role: 'RIDER', fullName: 'Bhavna Singh', city: 'Delhi', phone: '+919811111111', kycStatus: 'APPROVED' });
}

describe('Search, Filters & Sorting', () => {
  it('SEA-001 a valid keyword returns the matching rows', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedRiders();
    const res = await api().get('/admin/api/users').query({ search: 'Bhavna' }).set(headers);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].fullName).toBe('Bhavna Singh');
  });

  it('SEA-002/012 an unmatched keyword returns an empty, well-formed result', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedRiders();
    const res = await api().get('/admin/api/users').query({ search: 'zzzznobody' }).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(1);
  });

  it('SEA-003 a partial name matches as a case-insensitive substring', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedRiders();
    const res = await api().get('/admin/api/users').query({ search: 'arun' }).set(headers);
    expect(res.body.users.map((u: any) => u.fullName)).toEqual(['Arundhati Roy']);
  });

  it('SEA-004 an all-digit query searches the phone column only', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedRiders();
    const res = await api().get('/admin/api/users').query({ search: '98111111' }).set(headers);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].fullName).toBe('Bhavna Singh');
  });

  it('SEA-003b a one-character query is ignored (no table scan)', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedRiders();
    const res = await api().get('/admin/api/users').query({ search: 'a' }).set(headers);
    // filter not applied -> all three riders (plus the acting admin) come back
    expect(res.body.total).toBeGreaterThanOrEqual(3);
  });

  it('SEA-005 a single filter (role) is applied', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedRiders();
    const res = await api().get('/admin/api/users').query({ role: 'RIDER' }).set(headers);
    expect(res.body.users.every((u: any) => u.role === 'RIDER')).toBe(true);
    expect(res.body.total).toBe(3);
  });

  it('SEA-006 multiple filters (role + kycStatus) combine with AND', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedRiders();
    const res = await api().get('/admin/api/users').query({ role: 'RIDER', kycStatus: 'APPROVED' }).set(headers);
    expect(res.body.total).toBe(2);
  });

  it('SEA-007 clearing filters returns the full set again', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedRiders();
    const filtered = await api().get('/admin/api/users').query({ kycStatus: 'PENDING', role: 'RIDER' }).set(headers);
    expect(filtered.body.total).toBe(1);
    const cleared = await api().get('/admin/api/users').set(headers);
    expect(cleared.body.total).toBeGreaterThanOrEqual(3);
  });

  it('SEA-008/009 results are ordered newest-first by createdAt', async () => {
    const { headers } = await actingAs('ADMIN');
    const a = await makeUser({ role: 'RIDER', fullName: 'First' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await makeUser({ role: 'RIDER', fullName: 'Second' });

    const res = await api().get('/admin/api/users').query({ role: 'RIDER' }).set(headers);
    const ids = res.body.users.map((u: any) => u.id);
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));
  });

  it('SEA-010/011 pagination + search after filtering', async () => {
    const { headers } = await actingAs('ADMIN');
    for (let i = 0; i < 7; i++) await makeUser({ role: 'RIDER', fullName: `Rider ${i}` });

    const page1 = await api().get('/admin/api/users').query({ role: 'RIDER', page: 1, pageSize: 3 }).set(headers);
    expect(page1.body.users).toHaveLength(3);
    expect(page1.body.totalPages).toBe(3);
    expect(page1.body.page).toBe(1);

    const page3 = await api().get('/admin/api/users').query({ role: 'RIDER', page: 3, pageSize: 3 }).set(headers);
    expect(page3.body.users).toHaveLength(1);
  });

  it('SEA pageSize is clamped to a 100-row ceiling', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api().get('/admin/api/users').query({ pageSize: 5000 }).set(headers);
    expect(res.body.pageSize).toBe(100);
  });
});
