import React, { useEffect, useState } from 'react';
import {
  UserCog,
  Plus,
  ShieldCheck,
  MapPin,
  Calendar,
  DollarSign,
  Download,
  GitBranch,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Bike,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Pill, toneFor, Btn, Modal, Field, input, rupees, Loader, EmptyState } from '../components/ui';
import { errMsg } from '../api/errors';

type Tab = 'team' | 'hierarchy' | 'attendance' | 'salaries' | 'deployments';

export const Employees: React.FC = () => {
  const [tab, setTab] = useState<Tab>('team');
  const [employees, setEmployees] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [deployments, setDeployments] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; row: any } | { mode: 'mark_att'; row: any }>(null);
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, infraRes, hierRes, attRes, salRes, depRes] = await Promise.all([
        apiClient.get('/admin/api/employees'),
        apiClient.get('/admin/api/infrastructure'),
        apiClient.get('/admin/api/employees/hierarchy'),
        apiClient.get(`/admin/api/employees/attendance?date=${selectedDate}`),
        apiClient.get(`/admin/api/employees/salaries?month=${selectedMonth}&year=${selectedYear}`),
        apiClient.get('/admin/api/employees/deployments'),
      ]);

      setEmployees(empRes.data.data || []);
      setHubs(infraRes.data.hubs || []);
      setHierarchy(hierRes.data.data || []);
      setAttendances(attRes.data.data || []);
      setSalaries(salRes.data.data || []);
      setDeployments(depRes.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedMonth, selectedYear]);

  const handleSaveEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: any = {
      name: f.get('name'),
      phone: f.get('phone'),
      email: f.get('email') || undefined,
      role: f.get('role'),
      hubId: f.get('hubId') || undefined,
      baseSalary: f.get('baseSalary') ? parseInt(f.get('baseSalary') as string, 10) : 0,
      status: f.get('status') || 'ACTIVE',
    };

    setBusy(true);
    try {
      if (modal?.mode === 'add') {
        await apiClient.post('/admin/api/employees', body);
      } else if (modal?.mode === 'edit') {
        await apiClient.put(`/admin/api/employees/${modal.row.id}`, body);
      }
      setModal(null);
      await loadData();
    } catch (err: any) {
      alert(errMsg(err, 'Save failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleMarkAttendance = async (employeeId: string, status: string, note?: string) => {
    setBusy(true);
    try {
      await apiClient.post('/admin/api/employees/attendance', {
        employeeId,
        date: selectedDate,
        status,
        note,
      });
      await loadData();
    } catch (err: any) {
      alert(errMsg(err, 'Attendance update failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateSalaries = async () => {
    if (!confirm(`Generate salary payroll records for Month ${selectedMonth}/${selectedYear}?`)) return;
    setBusy(true);
    try {
      await apiClient.post('/admin/api/employees/salaries/generate', {
        month: selectedMonth,
        year: selectedYear,
      });
      await loadData();
    } catch (err: any) {
      alert(errMsg(err, 'Salary generation failed'));
    } finally {
      setBusy(false);
    }
  };

  const handlePaySalary = async (salaryId: string) => {
    if (!confirm('Mark this salary as PAID? This will automatically register an expense in Finance under SALARY.')) return;
    setBusy(true);
    try {
      await apiClient.post(`/admin/api/employees/salaries/${salaryId}/pay`);
      await loadData();
    } catch (err: any) {
      alert(errMsg(err, 'Payment mark failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleExportPayrollCsv = () => {
    window.open(`/admin/api/employees/salaries/export?month=${selectedMonth}&year=${selectedYear}`, '_blank');
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { id: 'team', label: `Staff & Team (${employees.length})`, icon: UserCog },
              { id: 'hierarchy', label: 'Org Hierarchy', icon: GitBranch },
              { id: 'attendance', label: 'Attendance', icon: Calendar },
              { id: 'salaries', label: 'Payroll & Salaries', icon: DollarSign },
              { id: 'deployments', label: `Deployments (${deployments.length})`, icon: Bike },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold capitalize transition ${
                  tab === t.id
                    ? 'bg-accent text-white shadow-neo-btn'
                    : 'bg-white text-[#7A756B] border border-[#E5E2DB] shadow-neo-sm'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'team' && (
          <Btn variant="primary" onClick={() => setModal({ mode: 'add' })}>
            <Plus className="w-3.5 h-3.5" /> Add Employee
          </Btn>
        )}
      </div>

      {/* 1. TEAM MEMBERS TAB */}
      {tab === 'team' && (
        <div className="space-y-4">
          <Card>
            {employees.length === 0 ? (
              <EmptyState icon="👥" title="No employees registered" hint="Add Hub Managers, Staff, or Technicians." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-extrabold text-[#7A756B] uppercase tracking-wide border-b border-[#E5E2DB]">
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Hub</th>
                      <th className="px-5 py-3">Join Date</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((row) => (
                      <tr key={row.id} className="border-b border-[#EFEDE8] last:border-0 hover:bg-[#FAF9F7] transition">
                        <td className="px-5 py-3">
                          <div className="font-extrabold text-[#16150F]">{row.name}</div>
                          <div className="text-xs text-[#7A756B]">{row.phone} · {row.email || 'No email'}</div>
                        </td>
                        <td className="px-5 py-3">
                          <Pill
                            tone={
                              row.role === 'SUPER_ADMIN'
                                ? 'green'
                                : row.role === 'HUB_MANAGER'
                                ? 'blue'
                                : row.role === 'SERVICE_PERSON'
                                ? 'amber'
                                : 'slate'
                            }
                          >
                            {row.role}
                          </Pill>
                        </td>
                        <td className="px-5 py-3 text-xs text-[#4A4740]">
                          {row.hub ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#1F6F43]" /> {row.hub.name}
                            </span>
                          ) : (
                            'Headquarters / All'
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#7A756B]">
                          {new Date(row.joinDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-5 py-3">
                          <Pill tone={toneFor(row.status)}>{row.status}</Pill>
                        </td>
                        <td className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap">
                          <Btn onClick={() => setModal({ mode: 'edit', row })}>Edit</Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 2. ORG HIERARCHY TAB */}
      {tab === 'hierarchy' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-base font-extrabold text-[#16150F] mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-[#1F6F43]" /> Operational Organization Tree
            </h3>

            {hierarchy.length === 0 ? (
              <EmptyState title="No hierarchy setup" hint="Create hubs and assign Hub Managers and Staff." />
            ) : (
              <div className="space-y-6">
                {hierarchy.map((hubItem) => (
                  <div key={hubItem.hubId} className="border border-[#E5E2DB] rounded-2xl p-5 bg-[#FAF9F7]">
                    <div className="flex items-center justify-between pb-3 border-b border-[#E5E2DB]">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-[#1F6F43]" />
                        <span className="font-extrabold text-[#16150F] text-base">{hubItem.hubName}</span>
                        <span className="text-xs text-[#7A756B]">({hubItem.city})</span>
                      </div>
                      <Pill tone="blue">Hub Floor</Pill>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* Manager */}
                      <div className="bg-white p-4 rounded-xl border border-[#E5E2DB]">
                        <p className="text-[10px] font-extrabold text-[#7A756B] uppercase tracking-wide mb-1">
                          Hub Manager
                        </p>
                        {hubItem.manager ? (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#EDF3EF] text-[#1F6F43] flex items-center justify-center font-bold text-xs">
                              {hubItem.manager.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-extrabold text-[#16150F]">{hubItem.manager.name}</p>
                              <p className="text-xs text-[#7A756B]">{hubItem.manager.phone}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-[#A39D91] italic">No manager assigned</p>
                        )}
                      </div>

                      {/* Staff & Technicians */}
                      <div className="bg-white p-4 rounded-xl border border-[#E5E2DB]">
                        <p className="text-[10px] font-extrabold text-[#7A756B] uppercase tracking-wide mb-1">
                          Assigned Staff & Technicians ({hubItem.employees?.length || 0})
                        </p>
                        <div className="space-y-2 mt-2">
                          {hubItem.employees && hubItem.employees.length > 0 ? (
                            hubItem.employees.map((emp: any) => (
                              <div key={emp.id} className="flex items-center justify-between text-xs py-1 border-b border-[#EFEDE8] last:border-0">
                                <span className="font-bold text-[#16150F]">{emp.name}</span>
                                <Pill tone={emp.role === 'SERVICE_PERSON' ? 'amber' : 'slate'}>{emp.role}</Pill>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-[#A39D91] italic">No staff assigned yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 3. ATTENDANCE TAB */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#E5E2DB] shadow-neo-sm">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#1F6F43]" />
              <span className="text-sm font-extrabold text-[#16150F]">Select Attendance Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`${input} py-1.5 px-3 text-xs w-auto`}
              />
            </div>
            <div className="text-xs text-[#7A756B]">
              Showing records for <span className="font-bold text-[#16150F]">{selectedDate}</span>
            </div>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-extrabold text-[#7A756B] uppercase tracking-wide border-b border-[#E5E2DB]">
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Role & Hub</th>
                    <th className="px-5 py-3">Check-in</th>
                    <th className="px-5 py-3">Check-out</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Quick Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const att = attendances.find((a) => a.employeeId === emp.id);
                    const currentStatus = att ? att.status : 'UNMARKED';

                    return (
                      <tr key={emp.id} className="border-b border-[#EFEDE8] last:border-0 hover:bg-[#FAF9F7]">
                        <td className="px-5 py-3 font-extrabold text-[#16150F]">{emp.name}</td>
                        <td className="px-5 py-3 text-xs text-[#7A756B]">
                          {emp.role} · {emp.hub?.name || 'HQ'}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#4A4740]">
                          {att?.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#4A4740]">
                          {att?.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <Pill
                            tone={
                              currentStatus === 'PRESENT'
                                ? 'green'
                                : currentStatus === 'HALF_DAY'
                                ? 'amber'
                                : currentStatus === 'ABSENT'
                                ? 'red'
                                : 'slate'
                            }
                          >
                            {currentStatus}
                          </Pill>
                        </td>
                        <td className="px-5 py-3 text-right space-x-1 whitespace-nowrap">
                          <Btn onClick={() => handleMarkAttendance(emp.id, 'PRESENT')}>Present</Btn>
                          <Btn onClick={() => handleMarkAttendance(emp.id, 'HALF_DAY')}>Half Day</Btn>
                          <Btn variant="danger" onClick={() => handleMarkAttendance(emp.id, 'ABSENT')}>Absent</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 4. SALARY & PAYROLL TAB */}
      {tab === 'salaries' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E5E2DB] shadow-neo-sm">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-[#1F6F43]" />
              <span className="text-sm font-extrabold text-[#16150F]">Payroll Period:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className={`${input} py-1.5 px-3 text-xs w-auto`}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2026, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className={`${input} py-1.5 px-3 text-xs w-auto`}
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Btn variant="primary" onClick={handleGenerateSalaries}>
                Generate Payroll
              </Btn>
              <Btn onClick={handleExportPayrollCsv}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Btn>
            </div>
          </div>

          <Card>
            {salaries.length === 0 ? (
              <EmptyState
                icon={<FileSpreadsheet className="w-8 h-8 mx-auto text-[#D6D2C8]" />}
                title="No payroll generated for this period"
                hint="Click 'Generate Payroll' to automatically compute monthly pay."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-extrabold text-[#7A756B] uppercase tracking-wide border-b border-[#E5E2DB]">
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-5 py-3">Base Salary</th>
                      <th className="px-5 py-3">Deductions</th>
                      <th className="px-5 py-3">Bonuses</th>
                      <th className="px-5 py-3">Net Pay</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaries.map((s) => (
                      <tr key={s.id} className="border-b border-[#EFEDE8] last:border-0 hover:bg-[#FAF9F7]">
                        <td className="px-5 py-3">
                          <div className="font-extrabold text-[#16150F]">{s.employee?.name}</div>
                          <div className="text-xs text-[#7A756B]">{s.employee?.role} · {s.employee?.phone}</div>
                        </td>
                        <td className="px-5 py-3 font-semibold text-[#16150F]">{rupees(s.baseSalary)}</td>
                        <td className="px-5 py-3 text-xs text-[#A02724]">- {rupees(s.deductions)}</td>
                        <td className="px-5 py-3 text-xs text-[#1F6F43]">+ {rupees(s.bonuses)}</td>
                        <td className="px-5 py-3 font-black text-[#16150F]">{rupees(s.netPaid)}</td>
                        <td className="px-5 py-3">
                          <Pill tone={s.status === 'PAID' ? 'green' : 'amber'}>{s.status}</Pill>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {s.status !== 'PAID' && (
                            <Btn variant="primary" onClick={() => handlePaySalary(s.id)}>
                              Mark as Paid
                            </Btn>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 5. BIKE DEPLOYMENT AUDIT LOGS */}
      {tab === 'deployments' && (
        <Card>
          {deployments.length === 0 ? (
            <EmptyState
              icon={<Bike className="w-8 h-8 mx-auto text-[#D6D2C8]" />}
              title="No deployment logs yet"
              hint="Logs are created automatically whenever an employee hands over or receives a bike."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-extrabold text-[#7A756B] uppercase tracking-wide border-b border-[#E5E2DB]">
                    <th className="px-5 py-3">Bike · Hub</th>
                    <th className="px-5 py-3">Deployed By</th>
                    <th className="px-5 py-3">Rider</th>
                    <th className="px-5 py-3">Deploy Date</th>
                    <th className="px-5 py-3">Return Date</th>
                    <th className="px-5 py-3">Odometer</th>
                    <th className="px-5 py-3">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((d) => (
                    <tr key={d.id} className="border-b border-[#EFEDE8] last:border-0 hover:bg-[#FAF9F7]">
                      <td className="px-5 py-3">
                        <div className="font-extrabold text-[#16150F]">{d.bike?.registrationNumber}</div>
                        <div className="text-xs text-[#7A756B]">{d.hub?.name}</div>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#4A4740]">
                        {d.deployedByEmployee?.name || 'Staff Executive'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-bold text-[#16150F]">{d.rider?.fullName || 'Rider'}</div>
                        <div className="text-xs text-[#7A756B]">{d.rider?.phone}</div>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#7A756B]">
                        {new Date(d.deployedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#7A756B]">
                        {d.returnedAt ? new Date(d.returnedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : (
                          <Pill tone="blue">ONGOING</Pill>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#4A4740]">
                        {d.odometerStart || 0} km → {d.odometerEnd !== null ? `${d.odometerEnd} km` : 'Active'}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#5C584F] max-w-xs truncate">
                        {d.conditionNotesOnDeploy || 'Good condition'}
                        {d.conditionNotesOnReturn ? ` | Return: ${d.conditionNotesOnReturn}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Add / Edit Employee Modal */}
      {modal && (modal.mode === 'add' || modal.mode === 'edit') && (
        <Modal
          title={modal.mode === 'add' ? 'Add Employee' : `Edit ${modal.mode === 'edit' ? modal.row.name : ''}`}
          onClose={() => setModal(null)}
          wide
        >
          <form onSubmit={handleSaveEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name">
                <input
                  name="name"
                  required
                  defaultValue={modal.mode === 'edit' ? modal.row.name : ''}
                  className={input}
                />
              </Field>
              <Field label="Phone Number (Log in with OTP)">
                <input
                  name="phone"
                  required
                  defaultValue={modal.mode === 'edit' ? modal.row.phone : ''}
                  placeholder="+91…"
                  className={input}
                />
              </Field>
              <Field label="Email Address">
                <input
                  name="email"
                  type="email"
                  defaultValue={modal.mode === 'edit' ? modal.row.email || '' : ''}
                  className={input}
                />
              </Field>
              <Field label="Role">
                <select
                  name="role"
                  defaultValue={modal.mode === 'edit' ? modal.row.role : 'STAFF'}
                  className={input}
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Access)</option>
                  <option value="HUB_MANAGER">HUB_MANAGER (Hub Supervisor)</option>
                  <option value="STAFF">STAFF (Floor Executive)</option>
                  <option value="SERVICE_PERSON">SERVICE_PERSON (Mechanic / Technician)</option>
                </select>
              </Field>
              <Field label="Assigned Hub">
                <select
                  name="hubId"
                  defaultValue={modal.mode === 'edit' ? modal.row.hubId || '' : ''}
                  className={input}
                >
                  <option value="">— HQ / All Hubs —</option>
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Monthly Base Salary (₹)">
                <input
                  name="baseSalary"
                  type="number"
                  defaultValue={modal.mode === 'edit' ? modal.row.baseSalary || 20000 : 20000}
                  className={input}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E2DB]">
              <Btn type="button" onClick={() => setModal(null)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? 'Saving…' : modal.mode === 'add' ? 'Create Employee' : 'Save Changes'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
