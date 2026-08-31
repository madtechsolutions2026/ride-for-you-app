import React, { useEffect, useState } from 'react';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Pill, toneFor, Btn, Modal, Field, input, rupees, Loader, EmptyState } from '../components/ui';

type View = 'bookings' | 'rentals';

export const Bookings: React.FC = () => {
  const [view, setView] = useState<View>('bookings');
  const [bookings, setBookings] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [availableBikes, setAvailableBikes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [handoverFor, setHandoverFor] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, r, fleet] = await Promise.all([
        apiClient.get('/admin/api/bookings'),
        apiClient.get('/admin/api/rentals'),
        apiClient.get('/admin/api/fleet'),
      ]);
      setBookings(b.data.bookings || []);
      setRentals(r.data.rentals || []);
      setAvailableBikes((fleet.data.bikes || []).filter((x: any) => x.status === 'AVAILABLE'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const act = async (url: string, body?: any, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await apiClient.post(url, body || {});
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const doHandover = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(`/admin/api/bookings/${handoverFor.id}/handover`, {
      bikeId: f.get('bikeId'),
      odometerStart: Number(f.get('odometerStart')) || undefined,
    });
    setHandoverFor(null);
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {(['bookings', 'rentals'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold capitalize transition ${
              view === v
                ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                : 'bg-white text-[#8A97A0] border border-[#EDF2F1] shadow-neo-sm'
            }`}
          >
            {v} ({v === 'bookings' ? bookings.length : rentals.length})
          </button>
        ))}
      </div>

      {view === 'bookings' && (
        <Card>
          {bookings.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-8 h-8 mx-auto text-[#CBD5E1]" />}
              title="No bookings yet"
              hint="Riders create bookings from the app. They'll appear here for confirmation and handover."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                  <th className="px-5 py-3">Ref / Rider</th>
                  <th className="px-5 py-3">Model · Plan</th>
                  <th className="px-5 py-3">Hub</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-extrabold text-[#172B3A]">{b.reference}</div>
                      <div className="text-xs text-[#8A97A0]">
                        {b.user?.fullName || '—'} · {b.user?.phone}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#475569]">
                      {b.model?.name}
                      <br />
                      <span className="text-[#8A97A0]">
                        {b.plan?.duration} · {rupees(b.plan?.price)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#475569]">{b.hub?.name}</td>
                    <td className="px-5 py-3 font-extrabold text-[#172B3A]">{rupees(b.totalAmount)}</td>
                    <td className="px-5 py-3">
                      <Pill tone={toneFor(b.status)}>{b.status}</Pill>
                    </td>
                    <td className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap">
                      {b.status === 'PENDING' && (
                        <Btn onClick={() => act(`/admin/api/bookings/${b.id}/confirm`)}>Confirm</Btn>
                      )}
                      {['CONFIRMED', 'READY'].includes(b.status) && (
                        <Btn variant="primary" onClick={() => setHandoverFor(b)}>
                          Handover <ArrowRight className="w-3 h-3" />
                        </Btn>
                      )}
                      {!['CANCELLED', 'EXPIRED', 'HANDED_OVER'].includes(b.status) && (
                        <Btn
                          variant="danger"
                          onClick={() =>
                            act(`/admin/api/bookings/${b.id}/cancel`, { reason: 'Cancelled by staff' }, 'Cancel this booking?')
                          }
                        >
                          Cancel
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

      {view === 'rentals' && (
        <Card>
          {rentals.length === 0 ? (
            <EmptyState icon="🛵" title="No active rentals" hint="Rentals start when a booking is handed over." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                  <th className="px-5 py-3">Rider</th>
                  <th className="px-5 py-3">Bike</th>
                  <th className="px-5 py-3">Weekly invoices</th>
                  <th className="px-5 py-3">Due back</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((r) => (
                  <tr key={r.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-extrabold text-[#172B3A]">{r.user?.fullName || '—'}</div>
                      <div className="text-xs text-[#8A97A0]">{r.user?.phone}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#475569]">
                      {r.bike?.registrationNumber}
                      <br />
                      <span className="text-[#8A97A0]">{r.bike?.model?.name}</span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {(r.weeklyInvoices || []).map((w: any) => (
                        <span key={w.id} className="mr-1">
                          <Pill tone={toneFor(w.status)}>
                            W{w.weekNumber} {rupees(w.amount)}
                          </Pill>
                        </span>
                      ))}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#475569]">
                      {new Date(r.expectedReturnAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={r.isOverdue ? 'red' : toneFor(r.status)}>
                        {r.isOverdue ? 'OVERDUE' : r.status}
                      </Pill>
                    </td>
                    <td className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap">
                      {['ACTIVE', 'OVERDUE'].includes(r.status) && (
                        <Btn onClick={() => act(`/admin/api/rentals/${r.id}/return`, {}, 'Mark the bike as returned?')}>
                          Return
                        </Btn>
                      )}
                      {r.status === 'RETURNED' && (
                        <>
                          <Btn
                            onClick={() => {
                              const desc = prompt('Damage note (leave blank if none):');
                              if (desc)
                                act(`/admin/api/rentals/${r.id}/damage`, {
                                  severity: 'MINOR',
                                  description: desc,
                                  estimatedCost: Number(prompt('Estimated cost ₹:') || 0),
                                });
                            }}
                          >
                            Log damage
                          </Btn>
                          <Btn variant="primary" onClick={() => act(`/admin/api/rentals/${r.id}/close`, {}, 'Close & complete this rental?')}>
                            Close
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

      {handoverFor && (
        <Modal title={`Handover · ${handoverFor.reference}`} onClose={() => setHandoverFor(null)}>
          <form onSubmit={doHandover} className="space-y-4">
            <p className="text-xs text-[#8A97A0]">
              Assign a physical bike to {handoverFor.user?.fullName}. The rental clock and week-1
              invoice start now.
            </p>
            <Field label="Bike">
              <select name="bikeId" required className={input}>
                <option value="">— pick an available bike —</option>
                {availableBikes.map((bk) => (
                  <option key={bk.id} value={bk.id}>
                    {bk.registrationNumber} · {bk.model?.name} · {bk.batteryPercent}%
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Odometer at handover (km)">
              <input name="odometerStart" type="number" className={input} placeholder="optional" />
            </Field>
            <div className="flex justify-end gap-2">
              <Btn type="button" onClick={() => setHandoverFor(null)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? 'Working…' : 'Confirm handover'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
