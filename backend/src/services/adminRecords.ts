/** Explicit allowlist: never expose Prisma models or arbitrary columns to clients. */
export type RecordField = { name: string; label: string; type?: 'text' | 'number' | 'date' | 'boolean'; required?: boolean; options?: string[]; min?: number; max?: number; lookup?: string; createOnly?: boolean; editOnly?: boolean };
export type RecordSpec = { model: string; label: string; sections: string[]; fields: RecordField[]; create?: string; remove?: string; readOnly?: boolean; where?: Record<string, unknown> };
const text = (name: string, label: string, required = false, lookup?: string): RecordField => ({ name, label, required, lookup });
const num = (name: string, label: string, required = false, max?: number): RecordField => ({ name, label, type: 'number', required, min: 0, max });
const choice = (name: string, label: string, options: string[], required = false): RecordField => ({ name, label, options, required });
const date = (name: string, label: string, required = false): RecordField => ({ name, label, type: 'date', required });
const initial = (field: RecordField): RecordField => ({ ...field, createOnly: true });
const rider = initial(text('userId', 'Rider', true, 'riders'));
const hub = text('hubId', 'Hub', false, 'hubs');
export const RECORDS: Record<string, RecordSpec> = {
  riders: { model: 'User', label: 'Riders', sections: ['riders'], where: { role: 'RIDER' }, remove: 'suspend', fields: [text('phone', 'Phone', true), text('fullName', 'Full name'), text('email', 'Email'), text('city', 'City'), choice('accountStatus', 'Account status', ['ACTIVE', 'SUSPENDED'])] },
  staff: { model: 'User', label: 'Staff access', sections: ['employees'], where: { role: { in: ['ADMIN', 'EXECUTIVE', 'SUPPORT'] } }, create: 'staff', remove: 'revoke', fields: [text('phone', 'Phone', true), text('fullName', 'Full name', true), text('email', 'Email'), choice('role', 'Access role', ['ADMIN', 'EXECUTIVE', 'SUPPORT'], true), text('assignedHubId', 'Assigned hub', false, 'hubs')] },
  hubs: { model: 'Hub', label: 'Hubs', sections: ['infrastructure'], fields: [text('name', 'Name', true), text('address', 'Address', true), num('lat', 'Latitude', true, 90), num('lng', 'Longitude', true, 180), text('city', 'City'), text('contactPhone', 'Contact phone'), text('openTime', 'Opening time'), text('closeTime', 'Closing time'), choice('status', 'Status', ['ACTIVE', 'INACTIVE'])] },
  stations: { model: 'SwapStation', label: 'Swap stations', sections: ['infrastructure'], fields: [text('name', 'Name', true), text('address', 'Address', true), num('lat', 'Latitude', true, 90), num('lng', 'Longitude', true, 180), text('openTime', 'Opening time'), text('closeTime', 'Closing time'), choice('status', 'Status', ['ACTIVE', 'INACTIVE'])] },
  models: { model: 'BikeModel', label: 'Vehicle models', sections: ['fleet', 'settings'], fields: [text('name', 'Name', true), choice('category', 'Category', ['SWAP', 'HOME'], true), num('topSpeedKmph', 'Top speed (km/h)', true), num('rangeKm', 'Range (km)', true), { name: 'requiresLicense', label: 'Requires licence', type: 'boolean' }, { name: 'chargerIncluded', label: 'Charger included', type: 'boolean' }, choice('status', 'Status', ['ACTIVE', 'INACTIVE'])] },
  bikes: { model: 'Bike', label: 'Physical vehicles', sections: ['fleet'], fields: [text('registrationNumber', 'Registration', true), text('modelId', 'Model', true, 'models'), { ...hub, required: true }, text('colour', 'Colour'), num('batteryPercent', 'Battery (%)', false, 100), num('odometerKm', 'Odometer (km)'), choice('status', 'Status', ['AVAILABLE', 'MAINTENANCE'])] },
  plans: { model: 'RentalPlan', label: 'Rental plans', sections: ['fleet', 'settings'], fields: [initial(text('modelId', 'Model', true, 'models')), initial(choice('duration', 'Duration', ['DAY', 'WEEK', 'MONTH'], true)), num('price', 'Rent (₹)', true), num('deposit', 'Deposit (₹)'), num('kmLimit', 'Distance limit (km)'), choice('status', 'Status', ['ACTIVE', 'INACTIVE'])] },
  bookings: { model: 'Booking', label: 'Bookings', sections: ['bookings'], create: 'booking', remove: 'cancelBooking', fields: [rider, initial(text('modelId', 'Model', true, 'models')), initial(choice('duration', 'Duration', ['DAY', 'WEEK', 'MONTH'], true)), initial(hub), text('nomineeName', 'Nominee name'), text('nomineeRelation', 'Nominee relation'), text('nomineePhone', 'Nominee phone'), date('startsAt', 'Planned start')] },
  rentals: { model: 'Rental', label: 'Rentals', sections: ['bookings'], create: 'handover', remove: 'returnRental', fields: [initial(text('bookingId', 'Confirmed booking', true, 'bookings')), initial(text('bikeId', 'Vehicle', true, 'bikes')), initial(num('odometerStart', 'Starting odometer')), date('expectedReturnAt', 'Expected return', true)] },
  requests: { model: 'RentalRequest', label: 'Rider requests', sections: ['bookings'], create: 'request', remove: 'cancelRequest', fields: [rider, initial(choice('type', 'Request type', ['EXTENSION', 'RETURN'], true)), initial(num('extraWeeks', 'Extra weeks')), initial(date('preferredSlotAt', 'Preferred return slot')), initial(hub), text('riderNote', 'Rider note')] },
  kyc: { model: 'KycVerification', label: 'KYC submissions', sections: ['kyc'], create: 'kyc', remove: 'rejectKyc', fields: [rider, text('fullName', 'Full name', true), date('dateOfBirth', 'Date of birth'), text('address', 'Address'), text('aadhaarNumber', 'Aadhaar number'), text('panNumber', 'PAN number')] },
  expenses: { model: 'Expense', label: 'Expenses', sections: ['finance'], fields: [choice('category', 'Category', ['RENT', 'SALARY', 'SERVICE', 'MISC'], true), num('amount', 'Amount (₹)', true), date('date', 'Date', true), hub, text('note', 'Note')] },
  payments: { model: 'Payment', label: 'Payments', sections: ['finance'], create: 'payment', remove: 'refundPayment', fields: [rider, initial(text('bookingId', 'Booking', false, 'bookings')), initial(choice('purpose', 'Purpose', ['RENT', 'DEPOSIT', 'PLATFORM_FEE', 'WEEKLY_RENT', 'LATE_FEE', 'DAMAGE'], true)), initial(num('amount', 'Amount (₹)', true)), initial(choice('provider', 'Provider', ['CASH', 'UPI_MANUAL'], true)), text('note', 'Note')] },
  invoices: { model: 'WeeklyInvoice', label: 'Weekly invoices', sections: ['finance'], remove: 'waiveInvoice', fields: [initial(text('rentalId', 'Rental', true, 'rentals')), initial(num('weekNumber', 'Week number', true)), date('periodStart', 'Period start', true), date('periodEnd', 'Period end', true), num('amount', 'Amount (₹)', true), date('dueAt', 'Due at', true)] },
  technicians: { model: 'ServicePerson', label: 'Technicians', sections: ['service'], fields: [text('name', 'Name', true), text('phone', 'Phone', true), text('specialization', 'Specialization'), hub, choice('status', 'Status', ['AVAILABLE', 'BUSY', 'INACTIVE'])] },
  service: { model: 'ServiceTicket', label: 'Service tickets', sections: ['service'], create: 'service', remove: 'cancelService', fields: [initial(text('bikeId', 'Vehicle', true, 'bikes')), text('reportedIssue', 'Reported issue', true), text('assignedServicePersonId', 'Technician', false, 'technicians'), date('scheduledTime', 'Scheduled time')] },
  parts: { model: 'ServicePart', label: 'Service parts', sections: ['service'], fields: [initial(text('serviceTicketId', 'Service ticket', true, 'service')), text('partName', 'Part name', true), num('cost', 'Unit cost (₹)', true), num('quantity', 'Quantity', true)] },
  notes: { model: 'ServiceNote', label: 'Service notes', sections: ['service'], fields: [initial(text('serviceTicketId', 'Service ticket', true, 'service')), text('note', 'Note', true)] },
  damage: { model: 'DamageReport', label: 'Damage reports', sections: ['service'], create: 'damage', remove: 'waiveDamage', fields: [initial(text('rentalId', 'Rental', true, 'rentals')), choice('severity', 'Severity', ['MINOR', 'MODERATE', 'MAJOR', 'TOTAL_LOSS'], true), text('description', 'Description', true), num('estimatedCost', 'Estimated cost (₹)')] },
  recovery: { model: 'RecoveryJob', label: 'Recovery jobs', sections: ['recovery'], create: 'recovery', remove: 'closeRecovery', fields: [initial(text('rentalId', 'Rental', false, 'rentals')), initial(text('bikeId', 'Vehicle', false, 'bikes')), initial(choice('type', 'Type', ['ROADSIDE', 'ACCIDENT', 'THEFT', 'POLICE_HOLD', 'BREAKDOWN'], true)), choice('priority', 'Priority', ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']), text('description', 'Description', true), text('locationText', 'Location'), text('reportedByPhone', 'Contact phone'), text('assignedToId', 'Assigned staff', false, 'staff'), text('vanLabel', 'Van / driver'), text('policeStation', 'Police station'), text('firNumber', 'FIR number')] },
  support: { model: 'SupportTicket', label: 'Support tickets', sections: ['support'], create: 'support', remove: 'closeSupport', fields: [rider, initial(text('bookingId', 'Booking', false, 'bookings')), choice('category', 'Category', ['BIKE_ISSUE', 'PAYMENT', 'BOOKING', 'OTHER'], true), text('subject', 'Subject'), text('description', 'Description', true), text('adminNotes', 'Internal notes')] },
  employees: { model: 'Employee', label: 'Employees', sections: ['employees'], create: 'employee', remove: 'deactivateEmployee', fields: [text('name', 'Name', true), text('phone', 'Phone', true), text('email', 'Email'), choice('role', 'Employee role', ['SUPER_ADMIN', 'HUB_MANAGER', 'STAFF', 'SERVICE_PERSON'], true), hub, num('baseSalary', 'Base salary (₹)'), choice('status', 'Status', ['ACTIVE', 'INACTIVE'])] },
  attendance: { model: 'Attendance', label: 'Attendance', sections: ['attendance', 'employees'], create: 'attendance', fields: [initial(text('employeeId', 'Employee', true, 'employees')), initial(date('date', 'Work date', true)), choice('status', 'Status', ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'], true), date('checkInTime', 'Check in'), date('checkOutTime', 'Check out'), text('note', 'Note'), text('reason', 'Correction reason', true)] },
  salaries: { model: 'Salary', label: 'Payroll drafts', sections: ['attendance', 'employees'], create: 'payroll', fields: [initial(num('month', 'Month', true, 12)), initial(num('year', 'Year', true)), num('bonuses', 'Bonus (₹)'), num('deductions', 'Deductions (₹)')] },
  deployments: { model: 'BikeDeploymentLog', label: 'Deployment history', sections: ['employees'], readOnly: true, fields: [] },
  swaps: { model: 'BatterySwap', label: 'Battery swap history', sections: ['infrastructure'], readOnly: true, fields: [] },
  wallet: { model: 'WalletTransaction', label: 'Wallet ledger', sections: ['riders', 'finance'], readOnly: true, fields: [] },
};

export function validateRecordInput(spec: RecordSpec, body: unknown, creating: boolean): Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Enter valid record fields');
  const input = body as Record<string, unknown>;
  const fields = spec.fields.filter(f => creating ? !f.editOnly : !f.createOnly);
  for (const key of Object.keys(input)) if (!fields.some(f => f.name === key)) throw new Error(`Field cannot be changed: ${key}`);
  const data: Record<string, any> = {};
  for (const field of fields) {
    const value = input[field.name];
    if (value === undefined) { if (creating && field.required) throw new Error(`${field.label} is required`); continue; }
    if (value === '' || value === null) { if (field.required) throw new Error(`${field.label} is required`); data[field.name] = null; continue; }
    if (field.type === 'number') {
      const minimum = field.name === 'lat' ? -90 : field.name === 'lng' ? -180 : ['weekNumber', 'quantity', 'month', 'year', 'extraWeeks'].includes(field.name) ? 1 : field.min;
      if (typeof value !== 'number' || !Number.isFinite(value) || (!['lat', 'lng'].includes(field.name) && (!Number.isSafeInteger(value) || value > 2147483647)) || (minimum !== undefined && value < minimum) || (field.max !== undefined && value > field.max)) throw new Error(`Invalid ${field.label}`);
      data[field.name] = value;
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`Invalid ${field.label}`);
      data[field.name] = value;
    } else {
      if (typeof value !== 'string' || value.length > 4000) throw new Error(`Invalid ${field.label}`);
      const trimmed = value.trim();
      if (!trimmed && field.required) throw new Error(`${field.label} is required`);
      if (field.options && !field.options.includes(trimmed)) throw new Error(`Invalid ${field.label}`);
      if (field.type === 'date') { const parsed = new Date(trimmed); if (isNaN(parsed.getTime())) throw new Error(`Invalid ${field.label}`); data[field.name] = parsed; }
      else data[field.name] = trimmed;
      if (/phone/i.test(field.name) && !/^\+?\d{10,15}$/.test(trimmed)) throw new Error(`Invalid ${field.label}`);
      if (field.name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new Error('Invalid email');
    }
  }
  if (!Object.keys(data).length) throw new Error('Enter at least one field');
  return data;
}

// These values are derived by the existing workflow when creating a record.
for (const [entity, names] of Object.entries({ rentals: ['expectedReturnAt'], salaries: ['bonuses', 'deductions'], employees: ['status'], support: ['adminNotes'], bookings: ['startsAt'], recovery: ['assignedToId', 'vanLabel', 'policeStation', 'firNumber'] })) {
  RECORDS[entity].fields = RECORDS[entity].fields.map(field => names.includes(field.name) ? { ...field, editOnly: true } : field);
}
RECORDS.staff.fields = RECORDS.staff.fields.map(field => field.name === 'phone' ? initial(field) : field);
RECORDS.employees.fields = RECORDS.employees.fields.map(field => field.name === 'baseSalary' ? { ...field, required: true } : field);
RECORDS.attendance.fields = RECORDS.attendance.fields.filter(field => field.name !== 'reason').map(field => field.name === 'status' ? choice('status', 'Status', ['PRESENT', 'ABSENT', 'LEAVE', 'WEEKLY_OFF', 'HOLIDAY'], true) : field.name === 'note' ? { ...field, label: 'Correction / absence reason', required: true } : field);
RECORDS.attendance.remove = 'correctAttendance';
RECORDS.requests.fields = RECORDS.requests.fields.filter(field => field.name !== 'hubId');
