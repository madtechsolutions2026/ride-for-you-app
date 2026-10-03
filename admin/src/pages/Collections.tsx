import React, { useCallback, useEffect, useState } from 'react';
import { Truck, AlertTriangle, Phone, History } from 'lucide-react';
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
  rupees,
} from '../components/ui';

/**
 * The collections bucket — bikes queued for recovery over unpaid rent.
 *
 * Raised automatically by the collections sweep two days after rent falls
 * due, once the rider has been chased every two hours and warned that this
 * would happen. Nothing here is created by hand; the desk's job is to assign
 * an agent and record the outcome.
 *
 * Deliberately separate from Roadside & Police. Collecting a bike over money
 * is a different conversation from recovering one after a crash, and mixing
 * them in one list meant the money jobs were read with the wrong urgency.
 */

interface RecoveryJob {
  id: string;
  reference: string;
  type: string;
  status: string;
  priority: string;
  description: string;
  locationText?: string | null;
  vanLabel?: string | null;
  createdAt: string;
  dispatchedAt?: string | null;
  bike?: { registrationNumber: string; batteryPercent?: number } | null;
  assignedTo?: { id: string; fullName?: string | null; phone?: string | null } | null;
  weeklyInvoice?: {
    id: string;
    weekNumber: number;
    amount: number;
    status: string;
    dueAt: string;
  } | null;
  rental?: {
    id: string;
    user?: {
      id: string;
      fullName?: string | null;
      phone?: string | null;
      recoveryCount: number;
      lastRecoveryAt?: string | null;
      writtenOffAmount: number;
    } | null;
  } | null;
}

interface Agent {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  role?: string;
}

const daysSince = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

export const Collections: React.FC = () => {
  const [jobs, setJobs] = useState<RecoveryJob[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assigning, setAssigning] = useState<RecoveryJob | null>(null);
  const [resolving, setResolving] = useState<RecoveryJob | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [jobsRes, staffRes] = await Promise.all([
        apiClient.get('/admin/api/recovery', { params: { type: 'NON_PAYMENT' } }),
        // Field staff are the ones who physically collect.
        apiClient.get('/admin/api/staff').catch(() => null),
      ]);

      setJobs(jobsRes.data?.jobs ?? []);
      setOutstanding(jobsRes.data?.outstanding ?? 0);

      const staff: Agent[] = staffRes?.data?.staff ?? staffRes?.data ?? [];
      setAgents(
        Array.isArray(staff)
          ? staff.filter((s) => s.role === 'EXECUTIVE' || s.role === 'ADMIN')
          : [],
      );
      setError(null);
    } catch (e) {
      setError(errMsg(e, 'Could not load the collections queue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePageRefresh(load);

  const post = async (id: string, body: Record<string, unknown>) => {
    setSaving(true);
    try {
      await apiClient.post(`/admin/api/recovery/${id}/update`, body);
      setAssigning(null);
      setResolving(null);
      await load();
    } catch (e) {
      setError(errMsg(e, 'Could not update the job'));
    } finally {
      setSaving(false);
    }
  };

  const assign = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assigning) return;
    const f = new FormData(e.currentTarget);
    void post(assigning.id, {
      status: 'DISPATCHED',
      assignedToId: String(f.get('assignedToId') || '') || null,
      vanLabel: String(f.get('vanLabel') || '').trim() || undefined,
    });
  };

  const resolve = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resolving) return;
    const f = new FormData(e.currentTarget);
    void post(resolving.id, {
      status: 'RESOLVED',
      resolutionNote: String(f.get('resolutionNote') || '').trim(),
    });
  };

  if (loading) return <Loader />;

  const open = jobs.filter((j) => j.status === 'OPEN');
  const active = jobs.filter((j) => j.status === 'DISPATCHED' || j.status === 'IN_PROGRESS');
  const done = jobs.filter((j) => j.status === 'RESOLVED' || j.status === 'CLOSED');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="u-label">Awaiting an agent</span>
          <h3 className="u-title text-[26px] leading-none text-ink mt-2 u-num">{open.length}</h3>
          <p className="text-[11.5px] text-ink-soft mt-1">Grace expired, nobody assigned</p>
        </Card>
        <Card className="p-4">
          <span className="u-label">Out for collection</span>
          <h3 className="u-title text-[26px] leading-none text-ink mt-2 u-num">{active.length}</h3>
          <p className="text-[11.5px] text-ink-soft mt-1">Agent dispatched</p>
        </Card>
        <Card className="p-4">
          <span className="u-label">Rent at risk</span>
          <h3 className="u-title text-[26px] leading-none text-ink mt-2 u-num">
            {rupees(outstanding)}
          </h3>
          <p className="text-[11.5px] text-ink-soft mt-1">Unpaid across open jobs</p>
        </Card>
        <Card className="p-4">
          <span className="u-label">Recovered</span>
          <h3 className="u-title text-[26px] leading-none text-ink mt-2 u-num">{done.length}</h3>
          <p className="text-[11.5px] text-ink-soft mt-1">Bikes back at a hub</p>
        </Card>
      </div>

      {error && (
        <Card className="p-4">
          <p className="text-[12.5px] text-signal-red">{error}</p>
        </Card>
      )}

      <Card className="p-5">
        <SectionHeader
          title="Bikes queued for collection"
          hint="Raised automatically 2 days after rent falls due. The rider was chased every 2 hours and warned before this."
        />

        {jobs.length === 0 ? (
          <EmptyState
            icon={<Truck className="w-7 h-7 mx-auto" strokeWidth={1.25} />}
            title="Nothing in collections"
            hint="Every rider is inside their payment window."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <TH>Ref</TH>
                <TH>Rider</TH>
                <TH>Bike</TH>
                <TH align="right">Owed</TH>
                <TH align="right">Age</TH>
                <TH>Agent</TH>
                <TH align="right">Status</TH>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const rider = j.rental?.user;
                const age = daysSince(j.createdAt);
                const repeat = (rider?.recoveryCount ?? 0) > 0;
                const paid = j.weeklyInvoice?.status === 'PAID';

                return (
                  <TR key={j.id}>
                    <TD className="u-num whitespace-nowrap">
                      {j.reference}
                      {paid && (
                        <span className="block mt-0.5">
                          <Pill tone="green">Paid — stand down</Pill>
                        </span>
                      )}
                    </TD>

                    <TD>
                      <span className="block text-ink">{rider?.fullName || 'Rider'}</span>
                      <span className="u-num text-[11.5px] text-ink-soft">
                        {rider?.phone || '—'}
                      </span>
                      {repeat && (
                        <span className="block mt-1">
                          <Pill tone="red">
                            <History className="w-2.5 h-2.5" strokeWidth={2} />
                            {rider!.recoveryCount} prior
                          </Pill>
                        </span>
                      )}
                    </TD>

                    <TD className="u-num text-ink-muted whitespace-nowrap">
                      {j.bike?.registrationNumber || '—'}
                    </TD>

                    <TD align="right">
                      {j.weeklyInvoice ? (
                        <>
                          <Amount value={j.weeklyInvoice.amount} />
                          <span className="block text-[11px] text-ink-soft">
                            week {j.weeklyInvoice.weekNumber}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </TD>

                    <TD align="right">
                      <span className={age >= 3 ? 'text-signal-red u-num' : 'u-num text-ink-muted'}>
                        {age}d
                      </span>
                    </TD>

                    <TD className="text-ink-soft">
                      {j.assignedTo?.fullName ? (
                        <>
                          <span className="block text-ink">{j.assignedTo.fullName}</span>
                          {j.vanLabel && (
                            <span className="u-num text-[11px]">{j.vanLabel}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-faint">Unassigned</span>
                      )}
                    </TD>

                    <TD align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        {j.status === 'OPEN' && (
                          <Btn variant="primary" onClick={() => setAssigning(j)}>
                            Assign agent
                          </Btn>
                        )}
                        {(j.status === 'DISPATCHED' || j.status === 'IN_PROGRESS') && (
                          <Btn variant="primary" onClick={() => setResolving(j)}>
                            Mark recovered
                          </Btn>
                        )}
                        {(j.status === 'RESOLVED' || j.status === 'CLOSED') && (
                          <Pill tone={toneFor(j.status)}>{j.status}</Pill>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Assign */}
      {assigning && (
        <Modal
          title={`Assign an agent — ${assigning.reference}`}
          onClose={() => !saving && setAssigning(null)}
        >
          <form onSubmit={assign} className="space-y-4">
            <div className="border border-rule rounded-sm p-3 text-[12.5px] text-ink space-y-1">
              <p>
                <span className="text-ink-soft">Rider:</span>{' '}
                {assigning.rental?.user?.fullName || 'Rider'}{' '}
                <span className="u-num text-ink-soft">{assigning.rental?.user?.phone}</span>
              </p>
              <p>
                <span className="text-ink-soft">Bike:</span>{' '}
                <span className="u-num">{assigning.bike?.registrationNumber}</span>
              </p>
              {assigning.weeklyInvoice && (
                <p>
                  <span className="text-ink-soft">Owed:</span>{' '}
                  <Amount value={assigning.weeklyInvoice.amount} /> for week{' '}
                  {assigning.weeklyInvoice.weekNumber}, due{' '}
                  {when(assigning.weeklyInvoice.dueAt)}
                </p>
              )}
              {assigning.locationText && (
                <p>
                  <span className="text-ink-soft">Last known hub:</span> {assigning.locationText}
                </p>
              )}
            </div>

            {assigning.weeklyInvoice?.status === 'PAID' && (
              <div className="border border-accent-line bg-accent-soft rounded-sm p-3">
                <p className="text-[12.5px] text-accent-deep">
                  This rider has since paid. Close the job instead of dispatching — sending an
                  agent now would be a wasted trip and a bad conversation.
                </p>
              </div>
            )}

            <Field label="Recovery agent">
              <select name="assignedToId" required defaultValue="" className={input}>
                <option value="" disabled>
                  Choose an agent…
                </option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName} {a.phone ? `· ${a.phone}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            {agents.length === 0 && (
              <p className="text-[12px] text-signal-amber">
                No field executives found. Add one under Employees & Payroll first.
              </p>
            )}

            <Field label="Van / vehicle label (optional)">
              <input name="vanLabel" className={input} placeholder="e.g. TS09 pickup · Suresh" />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Btn type="button" onClick={() => setAssigning(null)} disabled={saving}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={saving || agents.length === 0}>
                {saving ? 'Assigning…' : 'Dispatch agent'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Resolve */}
      {resolving && (
        <Modal
          title={`Mark recovered — ${resolving.reference}`}
          onClose={() => !saving && setResolving(null)}
        >
          <form onSubmit={resolve} className="space-y-4">
            <div className="border border-signal-amberLine bg-signal-amberSoft rounded-sm p-3">
              <p className="text-[12.5px] text-signal-amber flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>
                  This closes the rental and puts a permanent recovery mark on{' '}
                  {resolving.rental?.user?.fullName || 'the rider'}’s profile. The bike goes to
                  Maintenance for a check before it goes out again.
                </span>
              </p>
            </div>

            <Field label="What happened?">
              <textarea
                name="resolutionNote"
                rows={3}
                required
                className={input}
                placeholder="e.g. Collected from the rider's address in Madhapur at 4pm. Bike intact, charger returned."
              />
            </Field>

            <div className="flex items-center justify-between gap-3 pt-1">
              <a
                href={`tel:${resolving.rental?.user?.phone ?? ''}`}
                className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted hover:text-ink"
              >
                <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                Call the rider first
              </a>

              <div className="flex gap-2">
                <Btn type="button" onClick={() => setResolving(null)} disabled={saving}>
                  Cancel
                </Btn>
                <Btn type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Confirm recovered'}
                </Btn>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
