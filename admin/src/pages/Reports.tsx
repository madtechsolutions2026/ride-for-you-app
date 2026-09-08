import React from 'react';
import { Card, SectionHeader } from '../components/ui';

const PLANNED = [
  ['Monthly recurring revenue', 'Active rentals × plan rent, split by model and hub'],
  ['Collection rate', 'Weekly invoices raised vs. settled, with overdue ageing'],
  ['Fleet utilisation', 'Share of bikes on rent vs. available vs. in service'],
  ['Rider cohort retention', 'Renewals by signup month'],
  ['Churn and cancellations', 'Closed rentals with reason codes'],
];

export const Reports: React.FC = () => (
  <Card className="p-5">
    <SectionHeader
      title="Reports & MRR"
      hint="Not built yet — this screen previously rendered a copy of the Dashboard."
    />

    <p className="text-[13px] text-ink-muted max-w-2xl">
      Reporting needs a dedicated aggregation endpoint. Every figure below is derivable from the
      existing <span className="u-num">Rental</span>, <span className="u-num">WeeklyInvoice</span>{' '}
      and <span className="u-num">Payment</span> tables, but none of it is computed server-side
      today.
    </p>

    <ul className="mt-4 border-t border-rule">
      {PLANNED.map(([title, detail]) => (
        <li key={title} className="flex gap-4 py-2.5 border-b border-rule">
          <span className="text-[13px] font-medium text-ink w-56 shrink-0">{title}</span>
          <span className="text-[12.5px] text-ink-soft">{detail}</span>
        </li>
      ))}
    </ul>

    <p className="text-[11.5px] text-ink-soft mt-3">
      Blocked on <span className="u-num">GET /admin/api/reports/mrr</span>.
    </p>
  </Card>
);
