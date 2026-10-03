import React, { useEffect, useState } from 'react';
import {
  Users,
  Bike,
  FileCheck2,
  Receipt,
  MapPin,
  ArrowUpRight,
  Headphones,
  BatteryCharging,
  Clock,
  Wrench,
  Truck,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';
import { ScreenId } from '../nav';
import { FleetLiveMap } from '../components/FleetLiveMap';
import { apiClient } from '../api/client';
import { Card, SectionHeader, Pill, Amount, EmptyState, Loader, rupees } from '../components/ui';

/**
 * The dashboard.
 *
 * Rewritten because every figure on it that could not be loaded was being
 * invented instead. The old version fell back to `{ totalBikes: 54,
 * availableBikes: 42, utilizationRate: 22 }` when the stats call failed, so a
 * dead backend rendered as a healthy fleet; it badged "+18% growth" with no
 * growth calculation behind it anywhere; and it listed three hubs and three
 * bike models with hardcoded names, prices and unit counts while the real ones
 * sat one API call away.
 *
 * Rule for this screen now: if a number is not in the payload, the screen says
 * so. It never fills the gap itself.
 */

interface OverviewProps {
  stats: any;
  setActiveTab: (tab: ScreenId) => void;
}

interface Hub {
  id: string;
  name: string;
  address: string;
  status: string;
  openTime?: string | null;
  closeTime?: string | null;
  _count?: { bikes: number };
  bikes?: unknown[];
}

const dash = '—';

/** Renders a count, or an em dash when the payload genuinely lacks it. */
const num = (v: number | null | undefined) =>
  typeof v === 'number' ? v.toLocaleString('en-IN') : dash;

export const Overview: React.FC<OverviewProps> = ({ stats, setActiveTab }) => {
  const [hubs, setHubs] = useState<Hub[] | null>(null);
  const [hubsFailed, setHubsFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get('/admin/api/infrastructure')
      .then((res) => setHubs(res.data?.hubs ?? res.data?.data?.hubs ?? []))
      .catch(() => setHubsFailed(true));
  }, []);

  // No stats at all means the call is still in flight or it failed. Either way
  // the honest thing is to say nothing rather than to draw a plausible fleet.
  if (!stats) {
    return (
      <Card className="p-5">
        <SectionHeader
          title="Dashboard"
          hint="Waiting for live figures from the operations API."
        />
        <Loader />
      </Card>
    );
  }

  const riders = stats.riders ?? {};
  const fleet = stats.fleet ?? {};
  const finance = stats.finance ?? {};
  const ops = stats.operations ?? {};
  const queues = stats.queues ?? {};
  const activity = stats.activity ?? {};
  const models: any[] = stats.featuredModels ?? [];

  const tiles = [
    {
      label: 'Fleet vehicles',
      value: num(fleet.totalBikes),
      hint:
        typeof fleet.availableBikes === 'number' && typeof fleet.rentedBikes === 'number'
          ? `${fleet.availableBikes} ready · ${fleet.rentedBikes} on road`
          : 'Fleet breakdown unavailable',
      pill:
        typeof fleet.utilizationRate === 'number'
          ? { tone: 'green' as const, text: `${fleet.utilizationRate}% in service` }
          : null,
      screen: 'fleet' as ScreenId,
      icon: Bike,
    },
    {
      label: 'Registered riders',
      value: num(riders.total),
      hint:
        typeof riders.verified === 'number'
          ? `${riders.verified} KYC approved`
          : 'Verification counts unavailable',
      pill: null,
      screen: 'riders' as ScreenId,
      icon: Users,
    },
    {
      label: 'KYC queue',
      value: num(riders.pendingKyc),
      hint: riders.pendingKyc > 0 ? 'Documents waiting on review' : 'Queue clear',
      pill:
        riders.pendingKyc > 0
          ? { tone: 'amber' as const, text: 'Needs action' }
          : { tone: 'slate' as const, text: 'Clear' },
      screen: 'kyc' as ScreenId,
      icon: FileCheck2,
    },
    {
      label: 'Collected revenue',
      value: rupees(finance.collectedRevenue),
      hint:
        finance.overdueAmount > 0
          ? `${rupees(finance.overdueAmount)} overdue`
          : `${num(ops.activeRentals)} active rental(s)`,
      pill:
        finance.overdueAmount > 0
          ? { tone: 'red' as const, text: 'Overdue dues' }
          : { tone: 'green' as const, text: 'On track' },
      screen: 'finance' as ScreenId,
      icon: Receipt,
    },
  ];

  /* Everything waiting on a human, in one row. This is what staff open the
     dashboard to find out, and it previously took five clicks to assemble. */
  const workQueues = [
    { label: 'KYC to review', count: queues.pendingKyc, screen: 'kyc' as ScreenId, icon: FileCheck2 },
    { label: 'Bookings to confirm', count: queues.pendingBookings, screen: 'bookings' as ScreenId, icon: ClipboardList },
    { label: 'Support tickets open', count: queues.openTickets, screen: 'support' as ScreenId, icon: Headphones },
    { label: 'Extension / return asks', count: queues.pendingRentalRequests, screen: 'bookings' as ScreenId, icon: Clock },
    { label: 'Damage unresolved', count: queues.pendingDamage, screen: 'service' as ScreenId, icon: Wrench },
    { label: 'Recovery jobs open', count: queues.openRecovery, screen: 'recovery' as ScreenId, icon: Truck },
  ];

  const totalWaiting = workQueues.reduce(
    (sum, q) => sum + (typeof q.count === 'number' ? q.count : 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              onClick={() => setActiveTab(t.screen)}
              className="text-left bg-surface border border-rule rounded-md p-4 hover:border-rule-strong transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="u-label">{t.label}</span>
                <Icon
                  className="w-4 h-4 text-ink-faint group-hover:text-accent transition-colors shrink-0"
                  strokeWidth={1.75}
                />
              </div>
              <h3 className="u-title text-[26px] leading-none text-ink mt-2 mb-1.5 u-num">
                {t.value}
              </h3>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11.5px] text-ink-soft">{t.hint}</p>
                {t.pill && <Pill tone={t.pill.tone}>{t.pill.text}</Pill>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Work queues */}
      <Card className="p-5">
        <SectionHeader
          title="Waiting on someone"
          hint={
            totalWaiting === 0
              ? 'Nothing is queued right now.'
              : `${totalWaiting} item${totalWaiting === 1 ? '' : 's'} across every desk.`
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {workQueues.map((q) => {
            const Icon = q.icon;
            const n = typeof q.count === 'number' ? q.count : null;
            return (
              <button
                key={q.label}
                onClick={() => setActiveTab(q.screen)}
                className={`text-left border rounded-sm p-3 transition-colors ${
                  n && n > 0
                    ? 'border-signal-amberLine bg-signal-amberSoft hover:border-signal-amber'
                    : 'border-rule hover:border-rule-strong'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 mb-1.5 ${n && n > 0 ? 'text-signal-amber' : 'text-ink-faint'}`}
                  strokeWidth={1.75}
                />
                <p
                  className={`u-num text-[20px] leading-none ${
                    n && n > 0 ? 'text-signal-amber' : 'text-ink-muted'
                  }`}
                >
                  {n === null ? dash : n}
                </p>
                <p className="text-[11px] text-ink-soft mt-1 leading-tight">{q.label}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <FleetLiveMap />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Real models, real unit counts, real prices */}
        <Card className="p-5 lg:col-span-2">
          <SectionHeader
            title="Fleet models"
            hint="The three models with the most units on the road."
            actions={
              <button
                onClick={() => setActiveTab('fleet')}
                className="inline-flex items-center gap-1 text-[12px] text-accent hover:text-accent-deep"
              >
                View full fleet <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            }
          />

          {models.length === 0 ? (
            <EmptyState
              title="No active models"
              hint="Add a model with pricing plans from Vehicles & Fleet."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {models.map((m) => (
                <div key={m.id} className="border border-rule rounded-sm p-3">
                  <div className="h-28 bg-shell border border-rule rounded-sm flex items-center justify-center overflow-hidden mb-2.5">
                    {m.imageUrl ? (
                      <img src={m.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Bike className="w-7 h-7 text-ink-faint" strokeWidth={1.25} />
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-[13px] font-medium text-ink leading-tight">{m.name}</h4>
                    {m.fromPrice != null && (
                      <span className="u-num text-[12px] text-ink whitespace-nowrap">
                        <Amount value={m.fromPrice} />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-soft mt-0.5">{m.category}</p>

                  <div className="mt-2.5 pt-2.5 border-t border-rule flex items-center justify-between text-[11px] text-ink-soft">
                    <span className="inline-flex items-center gap-1">
                      <BatteryCharging className="w-3 h-3 text-accent" strokeWidth={1.75} />
                      <span className="u-num">{m.rangeKm} km</span>
                    </span>
                    <span className="u-num">{m.topSpeedKmph} km/h</span>
                    <Pill tone={m.units > 0 ? 'green' : 'slate'}>{m.units} units</Pill>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Money that is owed in both directions */}
        <Card className="p-5">
          <SectionHeader title="Money position" />

          <dl className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[12.5px] text-ink-soft">Collected to date</dt>
              <dd className="u-num text-[15px] text-ink">
                <Amount value={finance.collectedRevenue} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[12.5px] text-ink-soft">Invoiced, not yet due</dt>
              <dd className="u-num text-[15px] text-ink">
                <Amount value={finance.pendingInvoiceAmount} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[12.5px] text-ink-soft">Overdue</dt>
              <dd
                className={`u-num text-[15px] ${
                  finance.overdueAmount > 0 ? 'text-signal-red' : 'text-ink'
                }`}
              >
                <Amount value={finance.overdueAmount} />
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 pt-3 border-t border-rule">
              <dt className="text-[12.5px] text-ink-soft">
                Rider wallet credit
                <span className="block text-[10.5px] text-ink-faint">
                  Owed to riders — comes off future rent
                </span>
              </dt>
              <dd className="u-num text-[15px] text-ink">
                <Amount value={finance.walletLiability} />
              </dd>
            </div>
          </dl>

          <div className="mt-4 pt-3 border-t border-rule flex items-center justify-between text-[11px] text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <BatteryCharging className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
              <span className="u-num">{num(activity.swapsLast7Days)}</span> swaps this week
            </span>
            <button
              onClick={() => setActiveTab('finance')}
              className="inline-flex items-center gap-1 text-accent hover:text-accent-deep"
            >
              Finance <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </Card>
      </div>

      {/* Real hubs from the infrastructure endpoint */}
      <Card className="p-5">
        <SectionHeader
          title="Hubs"
          hint={
            typeof stats.infrastructure?.hubs === 'number'
              ? `${stats.infrastructure.hubs} active pickup point(s), ${stats.infrastructure.swapStations ?? dash} swap dock(s).`
              : undefined
          }
          actions={
            <button
              onClick={() => setActiveTab('infrastructure')}
              className="inline-flex items-center gap-1 text-[12px] text-accent hover:text-accent-deep"
            >
              Manage network <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          }
        />

        {hubsFailed ? (
          <div className="flex items-center gap-2 text-[12.5px] text-signal-red">
            <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
            Hub list could not be loaded.
          </div>
        ) : hubs === null ? (
          <Loader />
        ) : hubs.length === 0 ? (
          <EmptyState title="No hubs yet" hint="Add one from Hubs & Stations." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {hubs.slice(0, 6).map((h) => (
              <div key={h.id} className="border border-rule rounded-sm p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={1.75} />
                    <span className="text-[13px] font-medium text-ink truncate">{h.name}</span>
                  </span>
                  <Pill tone={h.status === 'ACTIVE' ? 'green' : 'slate'}>{h.status}</Pill>
                </div>
                <p className="text-[11.5px] text-ink-soft mt-1 truncate">{h.address}</p>
                <div className="mt-2.5 pt-2.5 border-t border-rule flex items-center justify-between text-[11px]">
                  <span className="u-num text-ink-muted">
                    {h._count?.bikes ?? h.bikes?.length ?? dash} bikes
                  </span>
                  <span className="u-num text-ink-soft">
                    {h.openTime && h.closeTime ? `${h.openTime} – ${h.closeTime}` : dash}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {stats.generatedAt && (
        <p className="text-[11px] text-ink-faint text-right">
          Figures as of {new Date(stats.generatedAt).toLocaleTimeString('en-IN')} · cached up to 30s
        </p>
      )}
    </div>
  );
};
