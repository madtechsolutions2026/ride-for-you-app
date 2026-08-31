import React, { useEffect, useState } from 'react';
import { ClipboardList, ArrowRight, Eye, X } from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Pill, toneFor, Btn, Modal, Field, input, rupees, Loader, EmptyState } from '../components/ui';

type View = 'bookings' | 'rentals';

const dt = (v: any) =>
  v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const d = (v: any) => (v ? new Date(v).toLocaleDateString('en-IN') : '—');

const paidState = (b: any) => {
  const paid = (b.payments || [])
    .filter((p: any) => p.status === 'SUCCESS' && p.amount > 0)
    .reduce((s: number, p: any) => s + p.amount, 0);
  if (paid <= 0) return { label: 'Unpaid', tone: 'red' as const, paid };
  if (paid >= (b.totalAmount || 0)) return { label: 'Paid', tone: 'green' as const, paid };
  return { label: 'Part-paid', tone: 'amber' as const, paid };
};

export const Bookings: React.FC = () => {
  const [view, setView] = useState<View>('bookings');
  const [bookings, setBookings] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [availableBikes, setAvailableBikes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [handoverFor, setHandoverFor] = useState<any | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    apiClient
      .get(`/admin/api/bookings/${detailId}`)
      .then((r) => setDetail(r.data))
      .catch((e) => alert(e.response?.data?.error || 'Failed to load booking'))
      .finally(() => setDetailLoading(false));
  }, [detailId]);

  const act = async (url: string, body?: any, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await apiClient.post(url, body || {});
      await load();
      if (detailId) {
        const r = await apiClient.get(`/admin/api/bookings/${detailId}`);
        setDetail(r.data);
      }
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

  const rowActions = (b: any) => (
    <>
      <Btn onClick={() => setDetailId(b.id)}>
        <Eye className="w-3 h-3" /> Details
      </Btn>
      {b.status === 'PENDING' && (
        <Btn
          onClick={() =>
            act(`/admin/api/bookings/${b.id}/confirm`, {}, 'Manually confirm this booking without an app payment?')
          }
        >
          Confirm
        </Btn>
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
    </>
  );

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
              hint="Riders create bookings from the app once their KYC is approved. They appear here for confirmation and handover."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                    <th className="px-5 py-3">Ref / Rider</th>
                    <th className="px-5 py-3">Model · Plan</th>
                    <th className="px-5 py-3">Hub</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Payment</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Booked</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const ps = paidState(b);
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFB] cursor-pointer"
                        onClick={() => setDetailId(b.id)}
                      >
                        <td className="px-5 py-3">
                          <div className="font-extrabold text-[#172B3A]">{b.reference}</div>
                          <div className="text-xs text-[#8A97A0]">
                            {b.user?.fullName || '—'} · {b.user?.phone}
                          </div>
                          <div className="mt-0.5">
                            <Pill tone={toneFor(b.user?.kycStatus || 'PENDING')}>
                              KYC {b.user?.kycStatus || 'PENDING'}
                            </Pill>
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
                          <Pill tone={ps.tone}>{ps.label}</Pill>
                          {ps.paid > 0 && (
                            <div className="text-[10px] text-[#8A97A0] mt-0.5">{rupees(ps.paid)} recd</div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Pill tone={toneFor(b.status)}>{b.status}</Pill>
                        </td>
                        <td className="px-5 py-3 text-xs text-[#8A97A0]">{d(b.createdAt)}</td>
                        <td
                          className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {rowActions(b)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {view === 'rentals' && (
        <Card>
          {rentals.length === 0 ? (
            <EmptyState icon="🛵" title="No active rentals" hint="Rentals start when a booking is handed over." />
          ) : (
            <div className="overflow-x-auto">
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
                      <td className="px-5 py-3 text-xs text-[#475569]">{d(r.expectedReturnAt)}</td>
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
                            <Btn
                              variant="primary"
                              onClick={() => act(`/admin/api/rentals/${r.id}/close`, {}, 'Close & complete this rental?')}
                            >
                              Close
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

      {detailId && (
        <Modal
          title={detail?.booking ? `Booking · ${detail.booking.reference}` : 'Booking'}
          onClose={() => setDetailId(null)}
          wide
        >
          {detailLoading || !detail ? (
            <Loader />
          ) : (
            <BookingDetail data={detail} onAction={act} busy={busy} availableBikes={availableBikes} onHandover={setHandoverFor} />
          )}
        </Modal>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------- */

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-[#EDF2F1] bg-[#F8FAFB] p-4">
    <h4 className="text-[10px] font-extrabold text-[#8A97A0] uppercase tracking-wide mb-2.5">{title}</h4>
    {children}
  </div>
);

const KV: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-[#8A97A0] font-semibold">{k}</span>
    <span className="text-[#172B3A] font-bold text-right">{v ?? '—'}</span>
  </div>
);

const BookingDetail: React.FC<{
  data: any;
  onAction: (url: string, body?: any, confirmMsg?: string) => void;
  busy: boolean;
  availableBikes: any[];
  onHandover: (b: any) => void;
}> = ({ data, onAction, busy, onHandover }) => {
  const b = data.booking;
  const fin = data.finance || {};
  const u = b.user || {};
  const r = b.rental;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={toneFor(b.status)}>{b.status}</Pill>
        <Pill tone={toneFor(u.kycStatus || 'PENDING')}>KYC {u.kycStatus || 'PENDING'}</Pill>
        {u.accountStatus && u.accountStatus !== 'ACTIVE' && <Pill tone="red">{u.accountStatus}</Pill>}
        <span className="text-xs text-[#8A97A0]">created {dt(b.createdAt)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Rider">
          <KV k="Name" v={u.fullName} />
          <KV k="Phone" v={u.phone} />
          <KV k="Email" v={u.email} />
          <KV k="City" v={u.city} />
          <KV k="Member since" v={d(u.createdAt)} />
        </Section>

        <Section title="Bike & plan">
          <KV k="Model" v={b.model?.name} />
          <KV k="Category" v={b.model?.category} />
          <KV k="Plan" v={b.plan?.duration} />
          <KV k="Top speed" v={b.model?.topSpeedKmph ? `${b.model.topSpeedKmph} km/h` : undefined} />
          <KV k="Rated range" v={b.model?.rangeKm ? `${b.model.rangeKm} km` : undefined} />
        </Section>

        <Section title="Pickup hub">
          <KV k="Hub" v={b.hub?.name} />
          <KV k="Address" v={b.hub?.address} />
          <KV k="City" v={b.hub?.city} />
          <KV k="Contact" v={b.hub?.contactPhone} />
        </Section>

        <Section title="Charges">
          <KV k="Weekly rent" v={rupees(b.rentAmount)} />
          <KV k="Refundable deposit" v={rupees(b.depositAmount)} />
          <KV k="Platform fee" v={rupees(b.platformFee)} />
          <div className="border-t border-[#E3EAEA] my-1" />
          <KV k="Total billed" v={<span className="text-[#172B3A]">{rupees(fin.billed ?? b.totalAmount)}</span>} />
          <KV k="Paid" v={<span className="text-[#38A169]">{rupees(fin.paid)}</span>} />
          {fin.refunded > 0 && <KV k="Refunded" v={rupees(fin.refunded)} />}
          <KV
            k="Balance"
            v={<span className={fin.balance > 0 ? 'text-[#DC2626]' : 'text-[#38A169]'}>{rupees(fin.balance)}</span>}
          />
        </Section>

        {(b.nominee || b.nomineeName) && (
          <Section title="Nominee / insurance">
            <KV k="Name" v={b.nomineeName} />
            <KV k="Relation" v={b.nomineeRelation} />
            <KV k="Phone" v={b.nomineePhone} />
            <KV k="Insurance ref" v={b.insuranceRef} />
          </Section>
        )}

        <Section title="Consent">
          <KV
            k="T&C accepted"
            v={b.consentAcceptedAt ? dt(b.consentAcceptedAt) : <span className="text-[#DC2626]">not accepted</span>}
          />
          <KV k="Language" v={b.consentLanguage} />
          <KV k="E-signature" v={b.consentSignatureKey ? 'captured' : '—'} />
        </Section>
      </div>

      <Section title={`Payments (${(b.payments || []).length})`}>
        {(b.payments || []).length === 0 ? (
          <p className="text-xs text-[#8A97A0]">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase">
                  <th className="py-1.5 pr-3">Purpose</th>
                  <th className="py-1.5 pr-3">Amount</th>
                  <th className="py-1.5 pr-3">Method</th>
                  <th className="py-1.5 pr-3">Txn</th>
                  <th className="py-1.5 pr-3">Status</th>
                  <th className="py-1.5">When</th>
                </tr>
              </thead>
              <tbody>
                {b.payments.map((p: any) => (
                  <tr key={p.id} className="border-t border-[#E3EAEA]">
                    <td className="py-1.5 pr-3 font-bold text-[#172B3A]">{p.purpose}</td>
                    <td className={`py-1.5 pr-3 font-bold ${p.amount < 0 ? 'text-[#DC2626]' : 'text-[#172B3A]'}`}>
                      {rupees(p.amount)}
                    </td>
                    <td className="py-1.5 pr-3 text-[#475569]">{p.provider}</td>
                    <td className="py-1.5 pr-3 text-[#8A97A0]">{p.providerPaymentId || '—'}</td>
                    <td className="py-1.5 pr-3">
                      <Pill tone={toneFor(p.status)}>{p.status}</Pill>
                    </td>
                    <td className="py-1.5 text-[#8A97A0]">{dt(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {r && (
        <Section title="Rental">
          <KV k="Bike" v={`${r.bike?.registrationNumber || '—'} (${r.bike?.batteryPercent ?? '—'}%)`} />
          <KV k="Status" v={<Pill tone={toneFor(r.status)}>{r.status}</Pill>} />
          <KV k="Handed over" v={dt(r.handoverAt)} />
          <KV k="Handover by" v={r.handoverBy?.fullName} />
          <KV k="Due back" v={dt(r.expectedReturnAt)} />
          {r.returnedAt && <KV k="Returned" v={dt(r.returnedAt)} />}
          <div className="mt-2 space-x-1">
            {(r.weeklyInvoices || []).map((w: any) => (
              <Pill key={w.id} tone={toneFor(w.status)}>
                W{w.weekNumber} {rupees(w.amount)}
              </Pill>
            ))}
          </div>
        </Section>
      )}

      {(data.timeline || []).length > 0 && (
        <Section title="Timeline">
          <ol className="space-y-2">
            {data.timeline.map((t: any, i: number) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-[10px] text-[#8A97A0] font-bold w-32 shrink-0 pt-0.5">{dt(t.at)}</span>
                <span className="text-[#172B3A] font-semibold">{t.label}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {b.status === 'PENDING' && (
          <Btn
            disabled={busy}
            onClick={() =>
              onAction(`/admin/api/bookings/${b.id}/confirm`, {}, 'Manually confirm this booking without an app payment?')
            }
          >
            Confirm manually
          </Btn>
        )}
        {['CONFIRMED', 'READY'].includes(b.status) && (
          <Btn variant="primary" disabled={busy} onClick={() => onHandover(b)}>
            Handover bike <ArrowRight className="w-3 h-3" />
          </Btn>
        )}
        {!['CANCELLED', 'EXPIRED', 'HANDED_OVER'].includes(b.status) && (
          <Btn
            variant="danger"
            disabled={busy}
            onClick={() =>
              onAction(`/admin/api/bookings/${b.id}/cancel`, { reason: 'Cancelled by staff' }, 'Cancel this booking?')
            }
          >
            <X className="w-3 h-3" /> Cancel booking
          </Btn>
        )}
      </div>
    </div>
  );
};
