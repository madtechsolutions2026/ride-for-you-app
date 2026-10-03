import React, { useCallback, useEffect, useState } from 'react';
import { Clock, CornerUpLeft } from 'lucide-react';
import { apiClient } from '../api/client';
import { errMsg } from '../api/errors';
import { usePageRefresh } from '../context/RefreshContext';
import {
  Card,
  SectionHeader,
  Table,
  TH,
  TD,
  TR,
  Pill,
  Amount,
  Btn,
  Modal,
  Field,
  input,
  EmptyState,
  Loader,
  toneFor,
} from '../components/ui';

/**
 * Extension and return-slot requests raised from the app.
 *
 * Approving an EXTENSION is the only thing that moves a rental's
 * `expectedReturnAt`, and the weekly billing job invoices against that date —
 * so approving here is what actually bills the extra weeks. The dialog says so
 * before you click.
 */

interface RentalRequest {
  id: string;
  reference: string;
  type: 'EXTENSION' | 'RETURN';
  status: string;
  extraWeeks?: number | null;
  quotedAmount?: number | null;
  preferredSlotAt?: string | null;
  riderNote?: string | null;
  decisionNote?: string | null;
  createdAt: string;
  user?: { id: string; fullName?: string | null; phone?: string | null };
  hub?: { name: string } | null;
  rental?: {
    id: string;
    expectedReturnAt: string;
    status: string;
    bike?: { registrationNumber: string };
    booking?: { reference: string; rentAmount: number };
  };
}

const FILTERS = ['PENDING', 'APPROVED', 'REJECTED', ''] as const;
const FILTER_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  '': 'All',
};

const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export const RiderRequests: React.FC = () => {
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [status, setStatus] = useState<string>('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deciding, setDeciding] = useState<{ req: RentalRequest; approve: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/api/rental-requests', {
        params: status ? { status } : {},
      });
      setRequests(res.data?.data?.requests ?? []);
      setError(null);
    } catch (e) {
      setError(errMsg(e, 'Could not load rider requests'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  usePageRefresh(load);

  const decide = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!deciding) return;

    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await apiClient.post(`/admin/api/rental-requests/${deciding.req.id}/decide`, {
        approve: deciding.approve,
        decisionNote: String(form.get('decisionNote') || '').trim() || undefined,
      });
      setDeciding(null);
      await load();
    } catch (err) {
      setError(errMsg(err, 'Could not record the decision'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <Card className="p-5">
      <SectionHeader
        title="Rider requests"
        hint="Extensions and return slots raised from the app. Nothing moves until you decide."
        actions={
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f || 'all'}
                onClick={() => setStatus(f)}
                className={`px-2.5 py-1 rounded-sm text-[12px] border transition-colors ${
                  status === f
                    ? 'border-accent bg-accent-soft text-ink'
                    : 'border-rule-strong bg-surface text-ink-muted hover:bg-rule-soft'
                }`}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <p className="text-[12.5px] text-signal-red mb-3 pb-3 border-b border-rule">{error}</p>
      )}

      {requests.length === 0 ? (
        <EmptyState
          title="Nothing here"
          hint={
            status === 'PENDING'
              ? 'No requests are waiting on a decision.'
              : 'No requests match this filter.'
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Reference</TH>
              <TH>Rider</TH>
              <TH>Request</TH>
              <TH>Bike</TH>
              <TH align="right">Value</TH>
              <TH>Raised</TH>
              <TH align="right">Status</TH>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <TR key={r.id}>
                <TD className="u-num whitespace-nowrap">{r.reference}</TD>

                <TD>
                  <span className="block text-ink">{r.user?.fullName || 'Rider'}</span>
                  <span className="block u-num text-[11.5px] text-ink-soft">
                    {r.user?.phone || '—'}
                  </span>
                </TD>

                <TD>
                  <span className="inline-flex items-center gap-1.5 text-ink">
                    {r.type === 'EXTENSION' ? (
                      <Clock className="w-3.5 h-3.5 text-ink-faint" strokeWidth={1.75} />
                    ) : (
                      <CornerUpLeft className="w-3.5 h-3.5 text-ink-faint" strokeWidth={1.75} />
                    )}
                    {r.type === 'EXTENSION'
                      ? `Extend ${r.extraWeeks} week${r.extraWeeks === 1 ? '' : 's'}`
                      : `Return ${when(r.preferredSlotAt)}`}
                  </span>
                  {r.riderNote && (
                    <span className="block text-[11.5px] text-ink-soft mt-0.5 max-w-xs truncate">
                      “{r.riderNote}”
                    </span>
                  )}
                </TD>

                <TD className="u-num text-ink-muted whitespace-nowrap">
                  {r.rental?.bike?.registrationNumber || '—'}
                </TD>

                <TD align="right">
                  {r.quotedAmount != null ? <Amount value={r.quotedAmount} /> : '—'}
                </TD>

                <TD className="text-ink-soft whitespace-nowrap">{when(r.createdAt)}</TD>

                <TD align="right">
                  {r.status === 'PENDING' ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <Btn
                        variant="primary"
                        onClick={() => setDeciding({ req: r, approve: true })}
                      >
                        Approve
                      </Btn>
                      <Btn variant="danger" onClick={() => setDeciding({ req: r, approve: false })}>
                        Reject
                      </Btn>
                    </div>
                  ) : (
                    <Pill tone={toneFor(r.status)}>{r.status}</Pill>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {deciding && (
        <Modal
          title={`${deciding.approve ? 'Approve' : 'Reject'} ${deciding.req.reference}`}
          onClose={() => !saving && setDeciding(null)}
        >
          <form onSubmit={decide} className="space-y-4">
            <div className="text-[13px] text-ink space-y-1.5">
              <p>
                <span className="text-ink-soft">Rider:</span>{' '}
                {deciding.req.user?.fullName || 'Rider'}
              </p>

              {deciding.req.type === 'EXTENSION' ? (
                <>
                  <p>
                    <span className="text-ink-soft">Asking for:</span>{' '}
                    {deciding.req.extraWeeks} more week
                    {deciding.req.extraWeeks === 1 ? '' : 's'}
                    {deciding.req.quotedAmount != null && (
                      <>
                        {' '}
                        at <Amount value={deciding.req.quotedAmount} />
                      </>
                    )}
                  </p>
                  {deciding.approve && (
                    <p className="text-[12.5px] text-signal-amber bg-signal-amberSoft border border-signal-amberLine rounded-sm p-2.5">
                      Approving moves the return date out by{' '}
                      {(deciding.req.extraWeeks ?? 0) * 7} days. Weekly billing invoices against
                      that date, so the extra weeks will be charged automatically.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  <span className="text-ink-soft">Return slot:</span>{' '}
                  {when(deciding.req.preferredSlotAt)} at{' '}
                  {deciding.req.hub?.name || 'their hub'}
                </p>
              )}

              {deciding.req.riderNote && (
                <p className="text-ink-soft">Rider note: “{deciding.req.riderNote}”</p>
              )}
            </div>

            <Field label={deciding.approve ? 'Note to rider (optional)' : 'Reason (shown to rider)'}>
              <textarea
                name="decisionNote"
                rows={3}
                required={!deciding.approve}
                className={input}
                placeholder={
                  deciding.approve
                    ? 'e.g. Confirmed — same bike, same weekly rate.'
                    : 'e.g. This bike is due for its 5,000 km service next week.'
                }
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Btn type="button" onClick={() => setDeciding(null)} disabled={saving}>
                Cancel
              </Btn>
              <Btn
                type="submit"
                variant={deciding.approve ? 'primary' : 'danger'}
                disabled={saving}
              >
                {saving ? 'Saving…' : deciding.approve ? 'Approve request' : 'Reject request'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
};
