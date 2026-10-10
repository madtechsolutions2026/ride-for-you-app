import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Attendance } from './Attendance';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

beforeEach(() => {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: { data: url.endsWith('/context') ? { employee: { id: 'e1', name: 'Employee', status: 'ACTIVE', hub: { name: 'Hub A' } }, employees: [], active: null, canReview: false, canPayroll: false, radius: 150 } : [] } }) as any);
  vi.mocked(apiClient.post).mockReset();
});

describe('Employee attendance page', () => {
  it('finalizes payroll through the in-page dialog and reveals the PDF download', async () => {
    let paid = false;
    const salary = { id: 's1', employeeId: 'e1', employee: { name: 'Employee' }, baseSalary: 18000, deductions: 0, bonuses: 0, netPaid: 18000 };
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: { data: url.endsWith('/context') ? { canPayroll: true, canReview: true, attendanceExempt: true, employees: [] } : url.endsWith('/salaries') ? [{ ...salary, status: paid ? 'PAID' : 'PENDING' }] : [] } }) as any);
    vi.mocked(apiClient.post).mockImplementation(async () => { paid = true; return { data: { data: { ...salary, status: 'PAID' } } } as any; });
    render(<Attendance />);
    fireEvent.click(await screen.findByRole('button', { name: 'Monthly payroll' }));
    const finalize = await screen.findByRole('button', { name: 'Finalize & mark paid' });
    await waitFor(() => expect(finalize).toBeEnabled());
    fireEvent.click(finalize);
    expect(screen.getByRole('dialog', { name: 'Finalize payroll' })).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & mark paid' }));
    expect(await screen.findByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith('/admin/api/employees/salaries/s1/pay', {});
  });
  it('shows the download option and explains when no payslip exists for the month', async () => {
    render(<Attendance />);
    fireEvent.click(await screen.findByRole('button', { name: 'My payslips' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download payslip PDF' })).toBeDisabled());
    expect(await screen.findByText(/No payslip has been issued for this month/)).toBeInTheDocument();
  });
  it('downloads a finalized payslip as a PDF without opening a popup', async () => {
    const createUrl = vi.fn(() => 'blob:test-payslip');
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    let filename = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    const popup = vi.spyOn(window, 'open');
    const pdf = new Blob(['%PDF-1.3'], { type: 'application/pdf' });
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => url.endsWith('/payslip') ? { data: pdf } as any : { data: { data: url.endsWith('/context') ? { employee: { id: 'e1', name: 'Employee', status: 'ACTIVE' }, employees: [], canReview: false, canPayroll: false } : url.endsWith('/salaries') ? [{ id: 's1', employeeId: 'e1', employeeName: 'Employee', employee: { name: 'Employee' }, baseSalary: 18000, absenceDays: 2, deductions: 1200, bonuses: 0, netPaid: 16800, status: 'PAID' }] : [] } } as any);
    try {
      render(<Attendance />);
      fireEvent.click(await screen.findByRole('button', { name: 'My payslips' }));
      const button = await screen.findByRole('button', { name: 'Download PDF' });
      await waitFor(() => expect(button).toBeEnabled());
      fireEvent.click(button);
      await waitFor(() => expect(click).toHaveBeenCalledOnce());
      expect(apiClient.get).toHaveBeenCalledWith('/admin/api/employees/salaries/s1/payslip', { responseType: 'blob' });
      expect(createUrl).toHaveBeenCalledWith(pdf);
      expect(filename).toMatch(/\.pdf$/);
      expect(popup).not.toHaveBeenCalled();
    } finally { click.mockRestore(); popup.mockRestore(); vi.unstubAllGlobals(); }
  });

  it('shows team attendance for Super Admin without personal clock-in or a History column', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: { data: url.endsWith('/context') ? { employee: { id: 'admin', name: 'Super Admin', status: 'ACTIVE' }, employees: [{ id: 'e1', name: 'Employee' }], active: null, attendanceExempt: true, canReview: true, canPayroll: true } : url.endsWith('/attendance') ? [{ id: 'a1', employeeId: 'e1', date: '2026-10-01', employee: { name: 'Employee' }, status: 'PRESENT', checkInTime: '2026-10-01T04:00:00Z', checkOutTime: '2026-10-01T12:00:00Z' }] : [] } }) as any);
    render(<Attendance />);
    await screen.findByRole('columnheader', { name: 'Clock in' });
    expect(screen.queryByText('My workday')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clock in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clock out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'History' })).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/admin/api/employees/attendance', expect.objectContaining({ params: expect.objectContaining({ scope: 'team' }) }));
  });

  it('clocks in without requesting browser location', async () => {
    const location = vi.fn();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: location } });
    render(<Attendance />);
    const button = await screen.findByRole('button', { name: 'Clock in' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/admin/api/employees/attendance/clock-in', {}));
    expect(location).not.toHaveBeenCalled();
    expect(screen.queryByText('Generate / refresh drafts')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Attendance scope')).not.toBeInTheDocument();
  });

  it('can clock in when browser geolocation is unavailable', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    render(<Attendance />);
    const button = await screen.findByRole('button', { name: 'Clock in' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/admin/api/employees/attendance/clock-in', {}));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
