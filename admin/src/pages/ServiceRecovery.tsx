import React, { useEffect, useState } from 'react';
import { Wrench, Truck, Plus, ShieldAlert } from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Pill, toneFor, Btn, Modal, Field, input, rupees, Loader, EmptyState } from '../components/ui';

type Tab = 'damage' | 'recovery';

export const ServiceRecovery: React.FC = () => {
  const [tab, setTab] = useState<Tab>('damage');
  const [damage, setDamage] = useState<any[]>([]);
  const [recovery, setRecovery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRecovery, setNewRecovery] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        apiClient.get('/admin/api/damage'),
        apiClient.get('/admin/api/recovery'),
      ]);
      setDamage(d.data.reports || []);
      setRecovery(r.data.jobs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

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
      await load();
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
      await load();
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
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['damage', 'recovery'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold capitalize transition ${
                tab === t
                  ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                  : 'bg-white text-[#8A97A0] border border-[#EDF2F1] shadow-neo-sm'
              }`}
            >
              {t === 'damage' ? <Wrench className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
              {t === 'damage' ? `Damage (${damage.length})` : `Recovery (${recovery.length})`}
            </button>
          ))}
        </div>
        {tab === 'recovery' && (
          <Btn variant="primary" onClick={() => setNewRecovery(true)}>
            <Plus className="w-3.5 h-3.5" /> Open Recovery Job
          </Btn>
        )}
      </div>

      {tab === 'damage' && (
        <Card>
          {damage.length === 0 ? (
            <EmptyState
              icon={<Wrench className="w-8 h-8 mx-auto text-[#CBD5E1]" />}
              title="No damage reports"
              hint="Executives log damage at return, from the Bookings → Rentals screen."
            />
          ) : (
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
          )}
        </Card>
      )}

      {tab === 'recovery' && (
        <Card>
          {recovery.length === 0 ? (
            <EmptyState icon={<Truck className="w-8 h-8 mx-auto text-[#CBD5E1]" />} title="No recovery jobs" />
          ) : (
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
          )}
        </Card>
      )}

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
