import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { errMsg } from '../api/errors';
import { Btn, Card, input, rupees } from '../components/ui';
import { Pencil, Plus } from 'lucide-react';

const indiaDate = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const clock = (v?: string) => v ? new Date(v).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const duration = (r: any) => r.checkInTime && r.checkOutTime ? `${((+new Date(r.checkOutTime) - +new Date(r.checkInTime)) / 3600000).toFixed(2)} h` : r.checkInTime ? 'Missing clock-out / open shift' : '—';

export const Attendance: React.FC = () => {
  const [context, setContext] = useState<any>(null);
  const [month, setMonth] = useState(indiaDate().slice(0, 7));
  const [scope, setScope] = useState('mine');
  const [employeeId, setEmployeeId] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [tab, setTab] = useState('attendance');
  const requestId = useRef(0);
  const params = { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) };

  async function load() {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const c = await apiClient.get('/admin/api/employees/attendance/context');
      const effectiveScope = c.data.data.attendanceExempt && c.data.data.canReview ? 'team' : scope;
      const [a, s] = await Promise.all([
        apiClient.get('/admin/api/employees/attendance', { params: { ...params, scope: effectiveScope, employeeId: employeeId || undefined } }),
        apiClient.get('/admin/api/employees/salaries', { params }),
      ]);
      if (currentRequest !== requestId.current) return;
      setContext(c.data.data); setRecords(a.data.data); setSalaries(s.data.data);
    } catch (e) {
      if (currentRequest === requestId.current) { setRecords([]); setSalaries([]); setError(errMsg(e, 'Could not load attendance and payroll')); }
    }
    finally { if (currentRequest === requestId.current) setLoading(false); }
  }
  useEffect(() => { void load(); }, [month, scope, employeeId]);
  async function action(fn: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); setMessage(success); await load(); }
    catch (e) { setError(errMsg(e, e instanceof Error ? e.message : 'Action failed')); }
    finally { setBusy(false); }
  }
  async function clockIn() {
    await action(() => apiClient.post('/admin/api/employees/attendance/clock-in', {}), 'Clocked in.');
  }
  async function download(url: string, name: string) {
    try {
      const response = await apiClient.get(url, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      const a = document.createElement('a'); a.href = objectUrl; a.download = name; a.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (e: any) {
      if (e.response?.data instanceof Blob) { const text = await e.response.data.text(); try { throw new Error(JSON.parse(text).error); } catch (parsed) { throw parsed; } }
      throw e;
    }
  }
  const selectable = context?.employees?.filter((e: any) => context.canPayroll || e.id !== context.employee?.id) ?? [];
  const effectiveScope = context?.attendanceExempt && context?.canReview ? 'team' : scope;
  const showAttendanceActions = effectiveScope === 'team' && !!context?.canReview;
  const ownPayslip = !context?.canPayroll ? salaries.find(s => s.status === 'PAID') : undefined;

  return <div className="space-y-5">
    {payment && <div className="fixed inset-0 z-50 bg-black/30 overflow-y-auto p-6" role="dialog" aria-modal="true" aria-label="Finalize payroll"><div className="max-w-lg mx-auto bg-white p-6 rounded-xl space-y-4">
      <h2 className="font-bold text-lg">Finalize payroll</h2>
      <p>Mark {rupees(payment.netPaid)} paid to <strong>{payment.employeeName ?? payment.employee.name}</strong> for {month}? This locks payroll and records the salary expense.</p>
      <p className="text-sm text-ink-muted">This records payment; it does not transfer money.</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-3"><Btn variant="primary" disabled={busy} onClick={() => action(async () => {
        const response = await apiClient.post(`/admin/api/employees/salaries/${payment.id}/pay`, {});
        if (response.data?.data?.status !== 'PAID') throw new Error('Payroll was not finalized. Refresh and try again.');
        setSalaries(rows => rows.map(row => row.id === payment.id ? { ...row, ...response.data.data } : row));
        setPayment(null);
      }, 'Payroll finalized and salary expense recorded. You can now download the PDF.')}>{busy ? 'Finalizing…' : 'Confirm & mark paid'}</Btn><Btn disabled={busy} onClick={() => { setPayment(null); setError(''); }}>Cancel</Btn></div>
    </div></div>}
    {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{error} <button onClick={() => { setError(''); void load(); }} className="underline">Retry</button></div>}
    {message && <div role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{message}</div>}
    {context && !context.attendanceExempt && <Card><div className="p-5 space-y-3">
      <h2 className="font-bold text-lg">My workday</h2>
      <p>{context?.employee?.name ?? 'No employee profile linked'} · {context?.employee?.hub?.name ?? 'No hub assigned'}</p>
      <p className="text-sm text-ink-muted">Location checking is disabled for now. All dates and times use India Standard Time.</p>
      {context?.active && <p>Clocked in {clock(context.active.checkInTime)}</p>}
      <Btn variant="primary" disabled={busy || loading || context?.employee?.status !== 'ACTIVE'} onClick={() => context?.active ? action(() => apiClient.post('/admin/api/employees/attendance/clock-out'), 'Clocked out.') : clockIn()}>{busy ? 'Please wait…' : context?.active ? 'Clock out' : 'Clock in'}</Btn>
      {!context?.employee && !loading && <p className="text-sm">Ask an administrator to save your employee profile with the same phone number used to log in.</p>}
    </div></Card>}
    <div className="flex flex-wrap gap-3 items-center">
      <Btn variant={tab === 'attendance' ? 'primary' : undefined} onClick={() => setTab('attendance')}>Attendance history</Btn>
      <Btn variant={tab === 'payroll' ? 'primary' : undefined} onClick={() => setTab('payroll')}>{context?.canPayroll ? 'Monthly payroll' : 'My payslips'}</Btn>
      <label className="text-sm">Month <input aria-label="Month" disabled={busy || loading} type="month" className={input} value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} /></label>
    </div>
    {tab === 'attendance' && <>
      {context?.canReview && <div className="flex flex-wrap gap-3 items-center">
        {!context.attendanceExempt && <select aria-label="Attendance scope" disabled={busy} className={`${input} max-w-xs`} value={scope} onChange={e => { setScope(e.target.value); setEmployeeId(''); }}><option value="mine">My attendance</option><option value="team">Team attendance</option></select>}
        {effectiveScope === 'team' && <><select aria-label="Employee filter" disabled={busy} className={`${input} max-w-xs`} value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">All employees</option>{context.employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}</select><Btn disabled={busy || loading || !selectable.length} onClick={() => setEditing({ date: indiaDate(), employeeId: employeeId || selectable[0]?.id, status: 'ABSENT' })}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add attendance</Btn></>}
      </div>}
      <p className="text-sm text-ink-muted">Missing records are unmarked, not automatic absences. Paid leave, weekly offs and holidays do not reduce salary. Corrections require a reason.</p>
      {loading ? <p>Loading…</p> : <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Date', 'Employee', 'Clock in', 'Clock out', 'Hours', 'Status'].map(h => <th key={h} className="p-3 text-left">{h}</th>)}{showAttendanceActions && <th className="p-3 text-right">Actions</th>}</tr></thead><tbody>
        {records.map(r => <tr key={r.id} className="border-t"><td className="p-3">{r.date.slice(0, 10)}</td><td className="p-3">{r.employee.name}</td><td className="p-3">{clock(r.checkInTime)}</td><td className="p-3">{clock(r.checkOutTime)}</td><td className="p-3">{duration(r)}</td><td className="p-3">{r.status === 'ABSENT' && !r.confirmedAt ? 'ABSENT (unconfirmed)' : r.status}</td>{showAttendanceActions && <td className="p-3 text-right">{selectable.some((e: any) => e.id === r.employeeId) && <Btn aria-label={`Edit attendance for ${r.employee.name} on ${r.date.slice(0, 10)}`} title="Edit attendance" disabled={busy || loading} onClick={() => setEditing(r)}><Pencil className="h-4 w-4" aria-hidden="true" /></Btn>}</td>}</tr>)}
        {!records.length && <tr><td colSpan={showAttendanceActions ? 7 : 6} className="p-6 text-center">No attendance recorded for this selection.</td></tr>}
      </tbody></table></div></Card>}
    </>}
    {tab === 'payroll' && <>
      {context && !context.canPayroll && <Card><div className="p-5 flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="font-bold text-lg">My payslip PDF</h2><p className="text-sm text-ink-muted">{loading ? 'Checking payslip availability…' : ownPayslip ? 'Your finalized payslip is ready to download for the selected month.' : salaries.length ? 'Payroll is still a draft. Download becomes available after Admin finalizes and marks it paid.' : 'No payslip has been issued for this month. Select a previous salary month to check your payslips.'}</p></div>
        <Btn variant="primary" disabled={busy || loading || !ownPayslip} onClick={() => ownPayslip && action(() => download(`/admin/api/employees/salaries/${ownPayslip.id}/payslip`, `payslip-${month}-${ownPayslip.employeeId}.pdf`), 'Payslip PDF downloaded.')}>Download payslip PDF</Btn>
      </div></Card>}
      <p className="text-sm text-ink-muted">Monthly salary ÷ 30 × confirmed unpaid absence days. The total deduction is rounded once to whole rupees and capped at monthly salary. Finalize after month-end; paid records are locked.</p>
      {context?.canPayroll && <div className="flex gap-3"><Btn variant="primary" disabled={busy || loading} onClick={() => action(() => apiClient.post('/admin/api/employees/salaries/generate', params), 'Payroll drafts generated. Paid records were preserved.')}>Generate / refresh drafts</Btn><Btn disabled={busy || loading} onClick={() => action(() => download(`/admin/api/employees/salaries/export?month=${params.month}&year=${params.year}`, `payroll-${month}.csv`), 'Payroll exported.')}>Export CSV</Btn></div>}
      <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Employee', 'Monthly salary', 'Unpaid days', 'Deduction', 'Bonuses', 'Net pay', 'Status', 'Actions'].map(h => <th key={h} className="text-left p-3">{h}</th>)}</tr></thead><tbody>{salaries.map(s => <tr key={s.id} className="border-t"><td className="p-3">{s.employeeName ?? s.employee.name}</td><td className="p-3">{rupees(s.baseSalary)}</td><td className="p-3">{s.absenceDays ?? "Not recorded"}</td><td className="p-3">{rupees(s.deductions)}</td><td className="p-3">{rupees(s.bonuses)}</td><td className="p-3 font-bold">{rupees(s.netPaid)}</td><td className="p-3">{s.status === 'PENDING' ? 'DRAFT' : s.status}</td><td className="p-3">{s.status === 'PAID' ? <Btn disabled={busy || loading} onClick={() => action(() => download(`/admin/api/employees/salaries/${s.id}/payslip`, `payslip-${month}-${s.employeeId}.pdf`), 'Payslip PDF downloaded.')}>Download PDF</Btn> : context?.canPayroll && <Btn disabled={busy || loading} onClick={() => { setError(''); setPayment(s); }}>Finalize & mark paid</Btn>}</td></tr>)}{!salaries.length && <tr><td colSpan={8} className="p-6 text-center">No payroll for this month.</td></tr>}</tbody></table></div></Card>
    </>}
    {editing && <div className="fixed inset-0 z-50 bg-black/30 overflow-y-auto p-6" role="dialog" aria-modal="true" aria-label={editing.id ? 'Edit attendance' : 'Add attendance'}><form className="max-w-xl mx-auto bg-white p-6 rounded-xl space-y-4" onSubmit={e => {
      e.preventDefault(); const data = new FormData(e.currentTarget);
      const body: any = { employeeId: data.get('employeeId'), date: data.get('date'), status: data.get('status'), note: data.get('note') };
      if (body.status === 'PRESENT') { for (const key of ['checkInTime', 'checkOutTime']) { const value = data.get(key); body[key] = value ? new Date(String(value) + ':00+05:30').toISOString() : null; } }
      void action(async () => { await apiClient.post('/admin/api/employees/attendance', body); setEditing(null); }, 'Attendance saved. Regenerate any payroll draft for this month.');
    }}><h2 className="font-bold text-lg">{editing.id ? 'Edit attendance' : 'Add attendance'}</h2>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {editing.id && <input type="hidden" name="employeeId" value={editing.employeeId} />}
      <label className="block">Employee<select name="employeeId" className={input} required disabled={!!editing.id} defaultValue={editing.employeeId}>{selectable.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <label className="block">Date (India)<input name="date" className={input} type="date" required readOnly={!!editing.id} max={indiaDate()} defaultValue={editing.date.slice(0, 10)} /></label>
      <label className="block">Status<select name="status" className={input} value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>{[['PRESENT', 'Present'], ['ABSENT', 'Confirmed unpaid absence'], ['LEAVE', 'Paid leave'], ['WEEKLY_OFF', 'Weekly off'], ['HOLIDAY', 'Paid holiday']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {editing.status === 'PRESENT' && <>{['checkInTime', 'checkOutTime'].map(key => <label className="block" key={key}>{key === 'checkInTime' ? 'Clock in' : 'Clock out'} (India time)<input name={key} className={input} type="datetime-local" defaultValue={editing[key] ? new Date(+new Date(editing[key]) + 330 * 60000).toISOString().slice(0, 16) : ''} /></label>)}</>}
      <label className="block">Reason<textarea name="note" className={input} required maxLength={1000} defaultValue={editing.note ?? ''} /></label>
      <div className="flex gap-3"><Btn variant="primary" type="submit" disabled={busy || loading}>{editing.id ? 'Save changes' : 'Add attendance'}</Btn><Btn type="button" disabled={busy || loading} onClick={() => setEditing(null)}>Cancel</Btn></div>
    </form></div>}
  </div>;
};
