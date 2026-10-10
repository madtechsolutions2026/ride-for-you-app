import PDFDocument from 'pdfkit';

export interface PayslipData {
  id: string; employeeId: string; employeeName: string; employeeRole: string; hubName: string;
  month: number; year: number; baseSalary: number; absenceDays: number | null;
  deductions: number; bonuses: number; netPaid: number; paidOn: Date | null;
}

/** Render finalized payroll snapshots as a formal, printable salary statement. */
export function buildPayslipPdf(salary: PayslipData): Promise<Buffer> {
  const period = new Date(Date.UTC(salary.year, salary.month - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const clean = (s: string) => s.replace(/[\r\n\t]+/g, ' ').trim();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, info: { Title: `Payslip - ${clean(salary.employeeName)} - ${period}`, Author: 'Ride For You', Subject: `Finalized payroll ${salary.id}` } });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      const x = 42, w = doc.page.width - 84, half = w / 2;
      const ink = '#202B36', muted = '#65717E', border = '#CCD2D8', tint = '#F2F4F6';
      const text = (s: string, tx: number, y: number, width: number, size = 9, bold = false, align: 'left' | 'right' | 'center' = 'left', color = ink) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color).text(s, tx, y, { width, align, height: 28, ellipsis: true });
      };
      const line = (y: number, start = x, end = x + w) => doc.strokeColor(border).lineWidth(0.6).moveTo(start, y).lineTo(end, y).stroke();
      const box = (y: number, height: number, fill?: string) => {
        if (fill) doc.rect(x, y, w, height).fill(fill);
        doc.rect(x, y, w, height).strokeColor(border).lineWidth(0.6).stroke();
      };
      text('RIDE FOR YOU', x, 43, w, 19, true, 'center');
      text('SALARY PAYSLIP', x, 74, w, 10, true, 'center', muted);
      text(`For the month of ${period}`, x, 94, w, 10, false, 'center');
      line(122);
      text('EMPLOYEE DETAILS', x, 139, w, 9, true);
      box(159, 132);
      doc.moveTo(x + half, 159).lineTo(x + half, 291).strokeColor(border).stroke();
      const detail = (label: string, value: string, col: number, y: number) => {
        const dx = x + col * half + 12;
        text(label, dx, y, half - 24, 7.5, false, 'left', muted);
        text(clean(value), dx, y + 14, half - 24, 9, true);
      };
      detail('Employee name', salary.employeeName, 0, 171);
      detail('Designation', salary.employeeRole.replace(/_/g, ' '), 1, 171);
      line(203);
      detail('Employee ID', salary.employeeId, 0, 215);
      detail('Hub / work location', salary.hubName, 1, 215);
      line(247);
      detail('Salary period', period, 0, 259);
      detail('Payroll status', 'PAID', 1, 259);

      box(305, 51, tint);
      const metrics = [ ['Salary basis', 'Monthly / 30 days'], ['Unpaid absence days', salary.absenceDays === null ? 'Not recorded' : String(salary.absenceDays)], ['Daily rate (INR)', money(salary.baseSalary / 30)] ];
      metrics.forEach(([label, value], i) => {
        const mx = x + i * w / 3 + 12;
        text(label, mx, 316, w / 3 - 24, 7.5, false, 'left', muted);
        text(value, mx, 331, w / 3 - 24, 9, true);
        if (i) doc.moveTo(x + i * w / 3, 305).lineTo(x + i * w / 3, 356).strokeColor(border).stroke();
      });
      text('SALARY BREAKDOWN', x, 375, w - 100, 9, true);
      text('All amounts in INR', x + w - 150, 375, 150, 8, false, 'right', muted);
      box(395, 150);
      doc.rect(x, 395, w, 30).fill(tint);
      doc.moveTo(x + half, 395).lineTo(x + half, 545).strokeColor(border).stroke();
      text('EARNINGS', x + 12, 405, half - 110, 8, true);
      text('AMOUNT', x + half - 96, 405, 84, 8, true, 'right');
      text('DEDUCTIONS', x + half + 12, 405, half - 110, 8, true);
      text('AMOUNT', x + w - 96, 405, 84, 8, true, 'right');
      line(425);
      const row = (label: string, amount: number, col: number, y: number, bold = false) => {
        const rx = x + col * half;
        text(label, rx + 12, y, half - 116, 9, bold);
        text(money(amount), rx + half - 100, y, 88, 9, bold, 'right');
      };
      row('Monthly salary', salary.baseSalary, 0, 439);
      row('Unpaid absence', salary.deductions, 1, 439);
      row('Bonus / additional pay', salary.bonuses, 0, 476);
      line(513);
      row('Total earnings', salary.baseSalary + salary.bonuses, 0, 526, true);
      row('Total deductions', salary.deductions, 1, 526, true);
      box(561, 51, tint);
      text('NET SALARY PAYABLE', x + 14, 579, 250, 10, true);
      text(`INR ${money(salary.netPaid)}`, x + 270, 576, w - 284, 16, true, 'right');
      const paidDate = salary.paidOn ? salary.paidOn.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'Not recorded';
      text(`Payment recorded on: ${paidDate}`, x, 627, w, 8.5);
      text('PAYROLL NOTES', x, 663, w, 8, true);
      text('Unpaid absence deduction is calculated on a fixed 30-day monthly salary basis. The total is rounded to the nearest rupee and limited to the monthly salary.', x, 681, w, 8, false, 'left', muted);
      if (salary.absenceDays === null) text('Legacy record: the original absence count was not recorded; finalized amounts are retained.', x, 714, w, 8, false, 'left', muted);
      line(751);
      text('This is a computer-generated payslip and does not require a signature.', x, 764, w, 8, false, 'center', muted);
      text(`Payroll reference: ${clean(salary.id)}`, x, 784, w - 40, 7, false, 'left', muted);
      text('1 / 1', x + w - 35, 784, 35, 7, false, 'right', muted);
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
