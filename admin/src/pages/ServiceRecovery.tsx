import React, { useEffect, useState } from 'react';
import { Wrench, Truck, Plus, ShieldAlert, UserCog, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Pill, toneFor, Btn, Modal, Field, input, rupees, Loader, EmptyState } from '../components/ui';

type Tab = 'tickets' | 'technicians' | 'damage' | 'recovery';

export const ServiceRecovery: React.FC = () => {
  const [tab, setTab] = useState<Tab>('tickets');
  const [serviceTickets, setServiceTickets] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [damage, setDamage] = useState<any[]>([]);
  const [recovery, setRecovery] = useState<any[]>([]);
  const [bikes, setBikes] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isNewTechOpen, setIsNewTechOpen] = useState(false);
  const [newRecovery, setNewRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [srvRes, techRes, dmgRes, recRes, fltRes, infraRes] = await Promise.all([
        apiClient.get('/admin/api/service/tickets'),
        apiClient.get('/admin/api/service/technicians'),
        apiClient.get('/admin/api/damage'),
        apiClient.get('/admin/api/recovery'),
        apiClient.get('/admin/api/fleet'),
        apiClient.get('/admin/api/infrastructure'),
      ]);

      setServiceTickets(srvRes.data.data?.tickets || []);
      setTechnicians(techRes.data.data || []);
      setDamage(dmgRes.data.reports || []);
      setRecovery(recRes.data.jobs || []);
      setBikes(fltRes.data.bikes || []);
      setHubs(infraRes.data.hubs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      bikeId: f.get('bikeId'),
      reportedIssue: f.get('reportedIssue'),
      assignedServicePersonId: f.get('assignedServicePersonId') || undefined,
      scheduledTime: f.get('scheduledTime') || undefined,
      note: f.get('note') || undefined,
    };

    setBusy(true);
    try {
      await apiClient.post('/admin/api/service/tickets', body);
      setIsNewTicketOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create service ticket');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTechnician = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: f.get('name'),
      phone: f.get('phone'),
      specialization: f.get('specialization') || undefined,
      hubId: f.get('hubId') || undefined,
    };

    setBusy(true);
    try {
      await apiClient.post('/admin/api/service/technicians', body);
      setIsNewTechOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add technician');
    } finally {
      setBusy(false);
    }
  };

  const handleAddPart = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTicket) return;
    const f = new FormData(e.currentTarget);
    const body = {
      partName: f.get('partName'),
      cost: f.get('cost'),
      quantity: f.get('quantity') || 1,
    };

    setBusy(true);
    try {
      await apiClient.post(`/admin/api/service/tickets/${selectedTicket.id}/parts`, body);
      const updated = await apiClient.get(`/admin/api/service/tickets/${selectedTicket.id}`);
      setSelectedTicket(updated.data.data);
      await loadData();
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add part');
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTicket) return;
    const f = new FormData(e.currentTarget);
    const note = f.get('note') as string;

    setBusy(true);
    try {
      await apiClient.post(`/admin/api/service/tickets/${selectedTicket.id}/notes`, { note });
      const updated = await apiClient.get(`/admin/api/service/tickets/${selectedTicket.id}`);
      setSelectedTicket(updated.data.data);
      await loadData();
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add note');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateTicketStatus = async (status: string) => {
    if (!selectedTicket) return;
    if (status === 'COMPLETED' && !confirm('Marking this service ticket as COMPLETED will restore the bike to AVAILABLE status and record the service cost as an expense in Finance. Proceed?')) {
      return;
    }

    setBusy(true);
    try {
      await apiClient.put(`/admin/api/service/tickets/${selectedTicket.id}`, { status });
      setSelectedTicket(null);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update ticket');
    } finally {
      setBusy(false);
    }
  };

  const resolveDamage = async (id: string, action: 'CHARGE' | 'WAIVE') => {
    let finalCost: number | undefined;
    if (action === 'CHARGE') {
      const v = prompt('Final charge amount ₹:');
      if (v === null) return;
      finalCost = Number(v);
    }
    setBusyId(id);
    try {
      await apiClient.post(`/admin/api/damage/${id}/resolve`, { action, finalCost });
      await loadData();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const updateRecovery = async (id: string, body: any) => {
    setBusyId(id);
    try {
      await apiClient.post(`/admin/api/recovery/${id}/update`, body);
      await loadData();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const createRecovery = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusyId('new');
    try {
      await apiClient.post('/admin/api/recovery', {
        type: f.get('type'),
        priority: f.get('priority'),
        description: f.get('description'),
        reportedByPhone: f.get('reportedByPhone') || undefined,
        locationText: f.get('locationText') || undefined,
      });
      setNewRecovery(false);
      await loadData();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { id: 'tickets', label: `Service Tickets (${serviceTickets.length})`, icon: Wrench },
              { id: 'technicians', label: `Technicians (${technicians.length})`, icon: UserCog },
              { id: 'damage', label: `Damage Reports (${damage.length})`, icon: AlertCircle },
              { id: 'recovery', label: `Roadside Recovery (${recovery.length})`, icon: Truck },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold capitalize transition ${
                  tab === t.id
                    ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                    : 'bg-white text-[#8A97A0] border border-[#EDF2F1] shadow-neo-sm'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'tickets' && (
          <Btn variant="primary" onClick={() => setIsNewTicketOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> New Service Ticket
          </Btn>
        )}

        {tab === 'technicians' && (
          <Btn variant="primary" onClick={() => setIsNewTechOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Technician
          </Btn>
        )}

        {tab === 'recovery' && (
          <Btn variant="primary" onClick={() => setNewRecovery(true)}>
            <Plus className="w-3.5 h-3.5" /> Open Recovery Job
          </Btn>
        )}
      </div>

      {/* 1. SERVICE TICKETS */}
      {tab === 'tickets' && (
        <Card>
          {serviceTickets.length === 0 ? (
            <EmptyState
              icon={<Wrench className="w-8 h-8 mx-auto text-[#CBD5E1]" />}
              title="No service tickets"
              hint="Create a service ticket to track bike maintenance, parts used, and repairs."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase tracking-wide border-b border-[#EDF2F1]">
                    <th className="px-5 py-3">Bike</th>
                    <th className="px-5 py-3">Reported Issue</th>
                    <th className="px-5 py-3">Technician</th>
                    <th className="px-5 py-3">Parts Cost</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceTickets.map((st) => (
                    <tr key={st.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3">
                        <div className="font-extrabold text-[#172B3A]">{st.bike?.registrationNumber}</div>
                        <div className="text-xs text-[#8A97A0]">{st.bike?.model?.name}</div>
                      </td>
                      <td className="px-5 py-3 font-semibold text-[#172B3A] max-w-xs">{st.reportedIssue}</td>
                      <td className="px-5 py-3 text-xs text-[#475569]">
                        {st.assignedServicePerson?.name || 'Unassigned'}
                      </td>
                      <td className="px-5 py-3 font-bold text-[#172B3A]">{rupees(st.totalCost)}</td>
                      <td className="px-5 py-3">
                        <Pill tone={st.status === 'COMPLETED' ? 'green' : st.status === 'IN_PROGRESS' ? 'amber' : 'blue'}>
                          {st.status}
                        </Pill>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#8A97A0]">
                        {new Date(st.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Btn variant="primary" onClick={() => setSelectedTicket(st)}>
                          View & Edit
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 2. TECHNICIANS */}
      {tab === 'technicians' && (
        <Card>
          {technicians.length === 0 ? (
            <EmptyState icon="🔧" title="No service personnel registered" hint="Add internal or outsourced mechanics." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase tracking-wide border-b border-[#EDF2F1]">
                    <th className="px-5 py-3">Technician Name</th>
                    <th className="px-5 py-3">Specialization</th>
                    <th className="px-5 py-3">Assigned Hub</th>
                    <th className="px-5 py-3">Active Tickets</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {technicians.map((tech) => (
                    <tr key={tech.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3">
                        <div className="font-extrabold text-[#172B3A]">{tech.name}</div>
                        <div className="text-xs text-[#8A97A0]">{tech.phone}</div>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#475569]">{tech.specialization || 'General Mechanic'}</td>
                      <td className="px-5 py-3 text-xs text-[#475569]">{tech.hub?.name || 'All Hubs'}</td>
                      <td className="px-5 py-3">
                        <Pill tone={tech.activeTicketCount > 0 ? 'amber' : 'slate'}>
                          {tech.activeTicketCount || 0} active
                        </Pill>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={tech.status === 'AVAILABLE' ? 'green' : 'amber'}>{tech.status}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 3. DAMAGE REPORTS */}
      {tab === 'damage' && (
        <Card>
          {damage.length === 0 ? (
            <EmptyState icon={<Wrench className="w-8 h-8 mx-auto text-[#CBD5E1]" />} title="No damage reports" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                    <th className="px-5 py-3">Bike · Rider</th>
                    <th className="px-5 py-3">Severity</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Est. cost</th>
                    <th className="px-5 py-3">Charge</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {damage.map((d) => (
                    <tr key={d.id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-extrabold text-[#172B3A]">{d.bike?.registrationNumber}</div>
                        <div className="text-xs text-[#8A97A0]">
                          {d.rental?.user?.fullName} · {d.rental?.user?.phone}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={toneFor(d.severity)}>{d.severity}</Pill>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#475569] max-w-xs">{d.description}</td>
                      <td className="px-5 py-3 font-bold text-[#172B3A]">{rupees(d.estimatedCost)}</td>
                      <td className="px-5 py-3">
                        <Pill tone={toneFor(d.chargeStatus)}>{d.chargeStatus}</Pill>
                      </td>
                      <td className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap">
                        {d.chargeStatus === 'PENDING' && (
                          <>
                            <Btn disabled={busyId === d.id} onClick={() => resolveDamage(d.id, 'WAIVE')}>
                              Waive
                            </Btn>
                            <Btn
                              variant="primary"
                              disabled={busyId === d.id}
                              onClick={() => resolveDamage(d.id, 'CHARGE')}
                            >
                              Charge rider
                            </Btn>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 4. ROADSIDE RECOVERY */}
      {tab === 'recovery' && (
        <Card>
          {recovery.length === 0 ? (
            <EmptyState icon={<Truck className="w-8 h-8 mx-auto text-[#CBD5E1]" />} title="No recovery jobs" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                    <th className="px-5 py-3">Ref · Type</th>
                    <th className="px-5 py-3">Bike / Rider</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recovery.map((j) => (
                    <tr key={j.id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-extrabold text-[#172B3A]">{j.reference}</div>
                        <Pill tone={j.type === 'POLICE_HOLD' || j.type === 'THEFT' ? 'red' : 'slate'}>
                          {j.type}
                        </Pill>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#475569]">
                        {j.bike?.registrationNumber || '—'}
                        <br />
                        <span className="text-[#8A97A0]">
                          {j.rental?.user?.fullName || j.reportedByPhone || ''}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#475569] max-w-[180px]">{j.locationText || '—'}</td>
                      <td className="px-5 py-3">
                        <Pill tone={toneFor(j.priority)}>{j.priority}</Pill>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={toneFor(j.status)}>{j.status}</Pill>
                      </td>
                      <td className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap">
                        {j.status === 'OPEN' && (
                          <Btn
                            disabled={busyId === j.id}
                            onClick={() => {
                              const van = prompt('Van / driver label:') || undefined;
                              updateRecovery(j.id, { status: 'DISPATCHED', vanLabel: van });
                            }}
                          >
                            Dispatch
                          </Btn>
                        )}
                        {['DISPATCHED', 'IN_PROGRESS'].includes(j.status) && (
                          <Btn
                            variant="primary"
                            disabled={busyId === j.id}
                            onClick={() => {
                              const note = prompt('Resolution note:') || undefined;
                              updateRecovery(j.id, { status: 'RESOLVED', resolutionNote: note });
                            }}
                          >
                            Resolve
                          </Btn>
                        )}
                        {(j.type === 'POLICE_HOLD' || j.type === 'THEFT') && j.status !== 'CLOSED' && (
                          <Btn
                            disabled={busyId === j.id}
                            onClick={() => {
                              const fir = prompt('FIR number:') || undefined;
                              const station = prompt('Police station:') || undefined;
                              updateRecovery(j.id, { firNumber: fir, policeStation: station });
                            }}
                          >
                            <ShieldAlert className="w-3 h-3" /> FIR
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
      )}

      {/* New Service Ticket Modal */}
      {isNewTicketOpen && (
        <Modal title="Create Service Ticket" onClose={() => setIsNewTicketOpen(false)}>
          <form onSubmit={handleCreateTicket} className="space-y-3.5">
            <Field label="Select Bike for Maintenance">
              <select name="bikeId" required className={input}>
                <option value="">— Select Bike —</option>
                {bikes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.registrationNumber} ({b.model?.name} · {b.hub?.name} · Status: {b.status})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Reported Issue / Reason">
              <input name="reportedIssue" required placeholder="e.g. Brake pad worn out, Battery swap connector loose" className={input} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Assign Technician">
                <select name="assignedServicePersonId" className={input}>
                  <option value="">— Assign Later —</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.specialization || 'General'})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Scheduled Date">
                <input name="scheduledTime" type="datetime-local" className={input} />
              </Field>
            </div>

            <Field label="Initial Inspection Note (optional)">
              <textarea name="note" rows={2} placeholder="Condition observations…" className={input} />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#EDF2F1]">
              <Btn type="button" onClick={() => setIsNewTicketOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create Ticket'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Technician Modal */}
      {isNewTechOpen && (
        <Modal title="Add Service Technician" onClose={() => setIsNewTechOpen(false)}>
          <form onSubmit={handleCreateTechnician} className="space-y-3.5">
            <Field label="Technician Name">
              <input name="name" required placeholder="e.g. Suresh Kumar" className={input} />
            </Field>

            <Field label="Phone Number">
              <input name="phone" required placeholder="+91…" className={input} />
            </Field>

            <Field label="Specialization">
              <input name="specialization" placeholder="e.g. Battery & Motor, Brakes & Body" className={input} />
            </Field>

            <Field label="Home Hub">
              <select name="hubId" className={input}>
                <option value="">— All Hubs / Mobile —</option>
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.city})
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#EDF2F1]">
              <Btn type="button" onClick={() => setIsNewTechOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Add Technician'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* View & Update Ticket Modal */}
      {selectedTicket && (
        <Modal
          title={`Service Ticket — ${selectedTicket.bike?.registrationNumber}`}
          onClose={() => setSelectedTicket(null)}
          wide
        >
          <div className="space-y-5">
            {/* Header info */}
            <div className="grid grid-cols-3 gap-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#EDF2F1]">
              <div>
                <p className="text-[10px] font-extrabold text-[#8A97A0] uppercase">Issue</p>
                <p className="text-sm font-extrabold text-[#172B3A]">{selectedTicket.reportedIssue}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-[#8A97A0] uppercase">Technician</p>
                <p className="text-sm font-extrabold text-[#172B3A]">{selectedTicket.assignedServicePerson?.name || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-[#8A97A0] uppercase">Status & Total Cost</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Pill tone={selectedTicket.status === 'COMPLETED' ? 'green' : 'amber'}>{selectedTicket.status}</Pill>
                  <span className="font-extrabold text-sm text-[#172B3A]">{rupees(selectedTicket.totalCost)}</span>
                </div>
              </div>
            </div>

            {/* Parts Used Section */}
            <div>
              <h4 className="text-xs font-extrabold text-[#172B3A] uppercase tracking-wide mb-2">Parts Replaced / Used</h4>
              {selectedTicket.parts?.length > 0 ? (
                <div className="space-y-1 mb-3">
                  {selectedTicket.parts.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 bg-white rounded-lg border border-[#EDF2F1]">
                      <span className="font-bold text-[#172B3A]">{p.partName} (x{p.quantity})</span>
                      <span className="font-extrabold text-[#172B3A]">{rupees(p.cost * p.quantity)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#94A3B8] italic mb-3">No parts recorded yet.</p>
              )}

              {selectedTicket.status !== 'COMPLETED' && (
                <form onSubmit={handleAddPart} className="flex gap-2 bg-[#F8FAFC] p-3 rounded-xl border border-[#EDF2F1]">
                  <input name="partName" required placeholder="Part name (e.g. Brake Shoe)" className={`${input} text-xs flex-1`} />
                  <input name="cost" type="number" required placeholder="Unit Cost ₹" className={`${input} text-xs w-28`} />
                  <input name="quantity" type="number" defaultValue="1" min="1" placeholder="Qty" className={`${input} text-xs w-16`} />
                  <Btn type="submit" disabled={busy}>Add Part</Btn>
                </form>
              )}
            </div>

            {/* Notes Section */}
            <div>
              <h4 className="text-xs font-extrabold text-[#172B3A] uppercase tracking-wide mb-2">Service Progress Notes</h4>
              {selectedTicket.notes?.length > 0 ? (
                <div className="space-y-1.5 mb-3">
                  {selectedTicket.notes.map((n: any) => (
                    <div key={n.id} className="text-xs p-2 bg-[#F8FAFC] rounded-lg border border-[#EDF2F1]">
                      <p className="text-[#334155]">{n.note}</p>
                      <span className="text-[10px] text-[#94A3B8]">{new Date(n.addedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#94A3B8] italic mb-3">No notes added.</p>
              )}

              {selectedTicket.status !== 'COMPLETED' && (
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input name="note" required placeholder="Add a progress observation…" className={`${input} text-xs flex-1`} />
                  <Btn type="submit" disabled={busy}>Add Note</Btn>
                </form>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-[#EDF2F1]">
              <div className="flex gap-2">
                {selectedTicket.status === 'ASSIGNED' && (
                  <Btn onClick={() => handleUpdateTicketStatus('IN_PROGRESS')} disabled={busy}>
                    Start Service (IN_PROGRESS)
                  </Btn>
                )}
                {selectedTicket.status !== 'COMPLETED' && (
                  <Btn variant="primary" onClick={() => handleUpdateTicketStatus('COMPLETED')} disabled={busy}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Service Completed
                  </Btn>
                )}
              </div>
              <Btn type="button" onClick={() => setSelectedTicket(null)}>
                Close
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* New Recovery Modal */}
      {newRecovery && (
        <Modal title="Open Recovery Job" onClose={() => setNewRecovery(false)}>
          <form onSubmit={createRecovery} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select name="type" className={input}>
                  {['ROADSIDE', 'BREAKDOWN', 'ACCIDENT', 'THEFT', 'POLICE_HOLD'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select name="priority" className={input} defaultValue="NORMAL">
                  {['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Reporter phone (optional)">
              <input name="reportedByPhone" className={input} placeholder="+91…" />
            </Field>
            <Field label="Location">
              <input name="locationText" className={input} placeholder="Near Inorbit Mall flyover" />
            </Field>
            <Field label="Description">
              <textarea name="description" required rows={3} className={input} />
            </Field>
            <div className="flex justify-end gap-2">
              <Btn type="button" onClick={() => setNewRecovery(false)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busyId === 'new'}>
                {busyId === 'new' ? 'Opening…' : 'Open job'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
