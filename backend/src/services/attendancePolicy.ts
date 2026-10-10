// Attendance dates are calendar dates in India, stored as UTC midnight keys.
export function indiaDay(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function dayKey(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid attendance date');
  const day = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) throw new Error('Invalid attendance date');
  return day;
}

export function period(month: unknown, year: unknown) {
  const m = Number(month), y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2020 || y > 2100) throw new Error('Choose a valid month and year');
  return { month: m, year: y, start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function absencePay(baseSalary: number, absenceDays: number, bonuses = 0) {
  if (![baseSalary, absenceDays, bonuses].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Salary, absences and bonuses must be non-negative whole numbers');
  // Existing money fields are whole rupees. Round the total once, not each day.
  const deductions = Math.min(baseSalary, Math.round(baseSalary * absenceDays / 30));
  return { deductions, netPaid: baseSalary - deductions + bonuses };
}

export function distanceMetres(lat: number, lng: number, hubLat: number, hubLng: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const a = Math.sin(rad(lat - hubLat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(hubLat)) * Math.sin(rad(lng - hubLng) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export const HUB_RADIUS_METRES = 150;
export function checkHubLocation(lat: number, lng: number, accuracy: number, hubLat: number, hubLng: number) {
  if (![lat, lng, accuracy].every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0) throw new Error('A valid current location is required');
  if (accuracy > 100) throw new Error('Location is too imprecise. Move outdoors near the hub and try again');
  if (distanceMetres(lat, lng, hubLat, hubLng) > HUB_RADIUS_METRES) throw new Error('Clock in within 150 metres of your assigned hub');
}
