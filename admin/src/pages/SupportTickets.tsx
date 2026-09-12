import React, { useCallback, useEffect, useState } from 'react';
import { Headphones, CheckCircle2, Clock, AlertCircle, MessageSquare, ExternalLink, Search } from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Pill, toneFor, Btn, Modal, Field, input, Loader, EmptyState } from '../components/ui';
import { errMsg } from '../api/errors';
import { TicketThread } from '../components/TicketThread';
import { usePageRefresh } from '../context/RefreshContext';

export const SupportTickets: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/api/support/tickets');
      const rows = res.data.data?.tickets || [];
      setTickets(rows);
      // Keep the open modal in sync after a reply changes the ticket's status.
      setSelectedTicket((current: any) =>
        current ? rows.find((t: any) => t.id === current.id) ?? current : current,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePageRefresh(load);

  const handleUpdateTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTicket) return;
    const f = new FormData(e.currentTarget);
    const status = f.get('status') as string;
    const adminNotes = f.get('adminNotes') as string;

    setBusy(true);
    try {
      await apiClient.put(`/admin/api/support/tickets/${selectedTicket.id}`, {
        status,
        adminNotes,
      });
      setSelectedTicket(null);
      await load();
    } catch (err: any) {
      alert(errMsg(err, 'Failed to update ticket'));
    } finally {
      setBusy(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = t.ticketNumber?.toLowerCase().includes(q);
      const matchRider = t.rider?.fullName?.toLowerCase().includes(q) || t.rider?.phone?.includes(q);
      const matchSubject = t.subject?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
      if (!matchNum && !matchRider && !matchSubject) return false;
    }
    return true;
  });

  const openCount = tickets.filter((t) => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-[#E5E2DB] shadow-neo-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EDF3EF] flex items-center justify-center text-[#1F6F43]">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#7A756B] uppercase tracking-wide">Total Tickets</p>
              <h3 className="text-xl font-black text-[#16150F]">{tickets.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-[#E5E2DB] shadow-neo-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FBEDEC] flex items-center justify-center text-[#A02724]">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#7A756B] uppercase tracking-wide">Needs Action</p>
              <h3 className="text-xl font-black text-[#A02724]">{openCount}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-[#E5E2DB] shadow-neo-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FBF3E2] flex items-center justify-center text-[#8A5A00]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#7A756B] uppercase tracking-wide">In Progress</p>
              <h3 className="text-xl font-black text-[#8A5A00]">{inProgressCount}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-[#E5E2DB] shadow-neo-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EDF3EF] flex items-center justify-center text-[#1F6F43]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#7A756B] uppercase tracking-wide">Resolved</p>
              <h3 className="text-xl font-black text-[#1F6F43]">{resolvedCount}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5E2DB] shadow-neo-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A756B]" />
            <input
              type="text"
              placeholder="Search ticket #, rider, subject…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${input} pl-9 text-xs`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${input} text-xs py-2 w-auto`}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">OPEN (Unresolved)</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`${input} text-xs py-2 w-auto`}
          >
            <option value="ALL">All Categories</option>
            <option value="BIKE_ISSUE">Bike Issue</option>
            <option value="PAYMENT">Payment & Billing</option>
            <option value="BOOKING">Booking & Rental</option>
            <option value="OTHER">Other / General</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <Card>
        {filteredTickets.length === 0 ? (
          <EmptyState
            icon={<Headphones className="w-8 h-8 mx-auto text-[#D6D2C8]" />}
            title="No support tickets found"
            hint="Riders submit tickets directly from the mobile app helpdesk."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-extrabold text-[#7A756B] uppercase tracking-wide border-b border-[#E5E2DB]">
                  <th className="px-5 py-3">Ticket ID</th>
                  <th className="px-5 py-3">Rider</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Subject & Issue</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => (
                  <tr key={t.id} className="border-b border-[#EFEDE8] last:border-0 hover:bg-[#FAF9F7] transition">
                    <td className="px-5 py-3 font-extrabold text-[#16150F]">
                      <span className="font-mono text-xs bg-[#EFEDE8] px-2 py-1 rounded-lg">
                        {t.ticketNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-extrabold text-[#16150F]">{t.rider?.fullName || 'Rider'}</div>
                      <div className="text-xs text-[#7A756B]">{t.rider?.phone}</div>
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={t.category === 'BIKE_ISSUE' ? 'red' : t.category === 'PAYMENT' ? 'amber' : 'slate'}>
                        {t.category}
                      </Pill>
                    </td>
                    <td className="px-5 py-3 max-w-sm">
                      <div className="font-bold text-[#16150F] truncate">{t.subject || 'Support Request'}</div>
                      <div className="text-xs text-[#5C584F] line-clamp-1">{t.description}</div>
                      {t.booking && (
                        <div className="text-[10px] text-[#7A756B] mt-0.5">
                          Ref: {t.booking.reference} ({t.booking.model?.name})
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={t.status === 'OPEN' ? 'red' : t.status === 'IN_PROGRESS' ? 'amber' : 'green'}>
                        {t.status}
                      </Pill>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#7A756B]">
                      {new Date(t.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Btn variant="primary" onClick={() => setSelectedTicket(t)}>
                        Inspect & Resolve
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Ticket Details & Resolution Modal */}
      {selectedTicket && (
        <Modal
          title={`Ticket Details — ${selectedTicket.ticketNumber}`}
          onClose={() => setSelectedTicket(null)}
          wide
        >
          <form onSubmit={handleUpdateTicket} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-[#FAF9F7] p-4 rounded-2xl border border-[#E5E2DB]">
              <div>
                <p className="text-[10px] font-extrabold text-[#7A756B] uppercase">Rider</p>
                <p className="text-sm font-extrabold text-[#16150F]">{selectedTicket.rider?.fullName || 'Rider'}</p>
                <p className="text-xs text-[#5C584F]">{selectedTicket.rider?.phone} · {selectedTicket.rider?.email || 'No email'}</p>
              </div>

              <div>
                <p className="text-[10px] font-extrabold text-[#7A756B] uppercase">Category & Booking</p>
                <p className="text-sm font-extrabold text-[#16150F]">{selectedTicket.category}</p>
                <p className="text-xs text-[#5C584F]">
                  {selectedTicket.booking ? `Booking ${selectedTicket.booking.reference} (${selectedTicket.booking.model?.name})` : 'No booking attached'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold text-[#16150F] mb-1">Subject</p>
              <div className="p-3 bg-white border border-[#E5E2DB] rounded-xl text-sm font-medium text-[#16150F]">
                {selectedTicket.subject || 'Support Ticket'}
              </div>
            </div>

            {/* The two-way thread. The rider sees every agent reply in the app,
                and can answer — which is what `adminNotes` alone never allowed. */}
            <TicketThread
              ticketId={selectedTicket.id}
              opening={selectedTicket.description}
              openedAt={selectedTicket.createdAt}
              riderName={selectedTicket.rider?.fullName || 'Rider'}
              onReplied={load}
            />

            {selectedTicket.attachmentUrl && (
              <div>
                <p className="text-xs font-extrabold text-[#16150F] mb-1">Attachment</p>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedTicket.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EDF3EF] text-[#1F6F43] text-xs font-extrabold rounded-xl hover:bg-[#D3E4DA] transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Uploaded Photo / Document
                  </a>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Field label="Status">
                <select name="status" defaultValue={selectedTicket.status} className={input}>
                  <option value="OPEN">OPEN (Needs Action)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Investigating)</option>
                  <option value="RESOLVED">RESOLVED (Fixed)</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </Field>

              <div className="flex items-center pt-5">
                {selectedTicket.resolvedAt && (
                  <p className="text-xs text-[#1F6F43] font-bold">
                    Resolved on {new Date(selectedTicket.resolvedAt).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
            </div>

            <Field label="Internal resolution note (not sent to the rider — use the reply box above for that)">
              <textarea
                name="adminNotes"
                rows={3}
                defaultValue={selectedTicket.adminNotes || ''}
                placeholder="Details of action taken, refund issued, parts replaced, or conversation with rider…"
                className={input}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E2DB]">
              <Btn type="button" onClick={() => setSelectedTicket(null)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save Changes'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
