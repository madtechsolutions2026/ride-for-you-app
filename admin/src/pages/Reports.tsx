import React, { useCallback, useEffect, useState } from 'react';
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
  Amount,
  Pill,
  EmptyState,
  Loader,
  rupees,
} from '../components/ui';

/**
 * Reports & MRR.
 *
 * This screen was a placeholder listing five figures it said were "blocked on
 * GET /admin/api/reports/mrr". That endpoint now exists and this reads it.
 *
 * Where the API returns null — a collection rate with nothing invoiced that
 * month, utilisation with no bikes — the cell shows a dash. A zero would read
 * as a measured result rather than an absence of data.
 */

interface MrrReport {
  mrr: { value: number; activeRentals: number; arpu: number | null; note: string };
  byModel: { name: string; rentals: number; mrr: number }[];
  byHub: { name: string; rentals: number; mrr: number }[];
  collection: {
    month: string;
    label: string;
    raised: number;
    settled: number;
    collected: number;
    rate: number | null;
  }[];
  ageing: Record<string, { count: number; amount: number }>;
  utilisation: {
    total: number;
    rented: number;
    available: number;
    reserved: number;
    maintenance: number;
    rentedShare: number | null;
  };
  churn: { month: string; label: string; closed: number; recovered: number }[];
  generatedAt: string;
}

const dash = '—';
const pct = (v: number | null) => (v === null ? dash : `${v}%`);

export const Reports: React.FC = () => {
  const [data, setData] = useState<MrrReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/api/reports/mrr');
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(errMsg(e, 'Could not load the report'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePageRefresh(load);

  if (loading) return <Loader />;

  if (error || !data) {
    return (
      <Card className="p-5">
        <SectionHeader title="Reports & MRR" />
        <p className="text-[13px] text-signal-red">{error ?? 'No report data.'}</p>
      </Card>
    );
  }

  const maxCollection = Math.max(...data.collection.map((c) => c.raised), 1);

  return (
    <div className="space-y-5">
      {/* Headline */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="u-label">Monthly recurring revenue</span>
          <h3 className="u-title text-[26px] leading-none text-ink mt-2 mb-1 u-num">
            {rupees(data.mrr.value)}
          </h3>
          <p className="text-[11.5px] text-ink-soft">{data.mrr.note}</p>
        </Card>

        <Card className="p-4">
          <span className="u-label">Active rentals</span>
          <h3 className="u-title text-[26px] leading-none text-ink mt-2 mb-1 u-num">
            {data.mrr.activeRentals}
          </h3>
          <p className="text-[11.5px] text-ink-soft">Bikes currently earning</p>
        </Card>

        <Card className="p-4">
          <span className="u-label">Revenue per rider</span>
          <h3 className="u-title text-[26px] leading-none text-ink mt-2 mb-1 u-num">
            {data.mrr.arpu === null ? dash : rupees(data.mrr.arpu)}
          </h3>
          <p className="text-[11.5px] text-ink-soft">Per month, per live rental</p>
        </Card>

        <Card className="p-4">
          <span className="u-label">Fleet on rent</span>
          <h3 className="u-title text-[26px] leading-none text-ink mt-2 mb-1 u-num">
            {pct(data.utilisation.rentedShare)}
          </h3>
          <p className="text-[11.5px] text-ink-soft">
            <span className="u-num">{data.utilisation.rented}</span> of{' '}
            <span className="u-num">{data.utilisation.total}</span> bikes
          </p>
        </Card>
      </div>

      {/* Collection */}
      <Card className="p-5">
        <SectionHeader
          title="Collection rate"
          hint="Weekly invoices raised against what has actually been settled, by month."
        />

        <Table>
          <thead>
            <tr>
              <TH>Month</TH>
              <TH align="right">Invoiced</TH>
              <TH align="right">Settled</TH>
              <TH align="right">Cash in</TH>
              <TH align="right">Rate</TH>
              <TH className="w-40">&nbsp;</TH>
            </tr>
          </thead>
          <tbody>
            {data.collection.map((c) => (
              <TR key={c.month}>
                <TD className="whitespace-nowrap text-ink">{c.label}</TD>
                <TD align="right">
                  <Amount value={c.raised} />
                </TD>
                <TD align="right">
                  <Amount value={c.settled} />
                </TD>
                <TD align="right" className="text-ink-muted">
                  <Amount value={c.collected} />
                </TD>
                <TD align="right">
                  {c.rate === null ? (
                    <span className="text-ink-faint">{dash}</span>
                  ) : (
                    <Pill tone={c.rate >= 90 ? 'green' : c.rate >= 70 ? 'amber' : 'red'}>
                      {c.rate}%
                    </Pill>
                  )}
                </TD>
                <TD>
                  {/* Bar of invoiced volume, with the settled share filled. */}
                  <div className="h-1.5 bg-rule-soft rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-accent"
                      style={{
                        width: `${Math.round((c.settled / maxCollection) * 100)}%`,
                      }}
                    />
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Ageing */}
        <Card className="p-5">
          <SectionHeader
            title="Overdue ageing"
            hint={`${data.ageing.total.count} invoice(s) past due, ${rupees(
              data.ageing.total.amount,
            )} outstanding.`}
          />

          {data.ageing.total.count === 0 ? (
            <EmptyState title="Nothing overdue" hint="Every raised invoice is inside its terms." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TH>Age</TH>
                  <TH align="right">Invoices</TH>
                  <TH align="right">Amount</TH>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Up to 7 days', 'upTo7Days', 'amber'],
                  ['8 – 30 days', 'upTo30Days', 'amber'],
                  ['Over 30 days', 'over30Days', 'red'],
                ].map(([label, key, tone]) => (
                  <TR key={key}>
                    <TD>
                      <Pill tone={tone as 'amber' | 'red'}>{label}</Pill>
                    </TD>
                    <TD align="right" className="u-num">
                      {data.ageing[key].count}
                    </TD>
                    <TD align="right">
                      <Amount value={data.ageing[key].amount} />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Utilisation */}
        <Card className="p-5">
          <SectionHeader title="Fleet utilisation" hint="Where every bike is right now." />

          {data.utilisation.total === 0 ? (
            <EmptyState title="No bikes" hint="Add units from Vehicles & Fleet." />
          ) : (
            <>
              <div className="flex h-2.5 rounded-sm overflow-hidden mb-4">
                {[
                  ['bg-accent', data.utilisation.rented],
                  ['bg-signal-blue', data.utilisation.reserved],
                  ['bg-rule-strong', data.utilisation.available],
                  ['bg-signal-amber', data.utilisation.maintenance],
                ].map(([cls, n], i) => (
                  <div
                    key={i}
                    className={cls as string}
                    style={{ width: `${((n as number) / data.utilisation.total) * 100}%` }}
                  />
                ))}
              </div>

              <dl className="space-y-2">
                {[
                  ['On rent', data.utilisation.rented, 'green'],
                  ['Reserved', data.utilisation.reserved, 'blue'],
                  ['Available', data.utilisation.available, 'slate'],
                  ['In service', data.utilisation.maintenance, 'amber'],
                ].map(([label, n, tone]) => (
                  <div key={label as string} className="flex items-center justify-between gap-3">
                    <dt>
                      <Pill tone={tone as 'green' | 'blue' | 'slate' | 'amber'}>
                        {label as string}
                      </Pill>
                    </dt>
                    <dd className="u-num text-[13px] text-ink">
                      {n as number}
                      <span className="text-ink-soft text-[11.5px] ml-1.5">
                        {Math.round(((n as number) / data.utilisation.total) * 100)}%
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* MRR by model */}
        <Card className="p-5">
          <SectionHeader title="MRR by model" hint="Which models are carrying the revenue." />

          {data.byModel.length === 0 ? (
            <EmptyState title="No live rentals" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TH>Model</TH>
                  <TH align="right">Rentals</TH>
                  <TH align="right">MRR</TH>
                </tr>
              </thead>
              <tbody>
                {data.byModel.map((m) => (
                  <TR key={m.name}>
                    <TD className="text-ink">{m.name}</TD>
                    <TD align="right" className="u-num text-ink-muted">
                      {m.rentals}
                    </TD>
                    <TD align="right">
                      <Amount value={m.mrr} />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Churn */}
        <Card className="p-5">
          <SectionHeader
            title="Rentals closed"
            hint="Completed returns and recoveries, by month."
          />

          <Table>
            <thead>
              <tr>
                <TH>Month</TH>
                <TH align="right">Closed</TH>
                <TH align="right">Of which recovered</TH>
              </tr>
            </thead>
            <tbody>
              {data.churn.map((c) => (
                <TR key={c.month}>
                  <TD className="text-ink whitespace-nowrap">{c.label}</TD>
                  <TD align="right" className="u-num">
                    {c.closed}
                  </TD>
                  <TD align="right" className="u-num">
                    {c.recovered > 0 ? (
                      <span className="text-signal-red">{c.recovered}</span>
                    ) : (
                      <span className="text-ink-faint">0</span>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <p className="text-[11px] text-ink-faint text-right">
        Computed {new Date(data.generatedAt).toLocaleString('en-IN')} · cached up to 2 minutes
      </p>
    </div>
  );
};
