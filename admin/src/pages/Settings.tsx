import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import {
  Card, SectionHeader, Table, TH, TD, TR, Pill, Amount, EmptyState, Loader,
} from '../components/ui';

interface Plan {
  id: string;
  duration: string;
  price: number;
  deposit?: number;
}

const INTEGRATIONS = [
  { name: 'PhonePe', purpose: 'Primary payment gateway', env: 'PHONEPE_*' },
  { name: 'Razorpay', purpose: 'Fallback payment gateway', env: 'RAZORPAY_*' },
  { name: 'Way2Chats', purpose: 'WhatsApp OTP and rent reminders', env: 'WAY2CHATS_API_KEY' },
  { name: 'Cloudflare R2', purpose: 'KYC document and image storage', env: 'R2_*' },
  { name: 'Expo Push', purpose: 'Rider mobile notifications', env: 'EXPO_TOKEN' },
];

export const Settings: React.FC<{ tab?: 'pricing' | 'integrations' }> = ({ tab = 'pricing' }) => {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/admin/api/fleet');
        setModels(res.data.models || []);
      } catch (e) {
        console.error('Error fetching pricing:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loader />;

  const rows = models.flatMap((m) =>
    (m.plans || []).map((p: Plan) => ({ model: m.name, category: m.category, ...p })),
  );

  if (tab === 'integrations') {
    return (
      <Card className="p-5">
        <SectionHeader
          title="Integrations"
          hint="Third-party services this deployment depends on. Credentials live in server environment variables and are never exposed to the dashboard."
        />
        <Table>
          <thead>
            <tr>
              <TH>Service</TH>
              <TH>Purpose</TH>
              <TH>Configured by</TH>
              <TH align="right">Live status</TH>
            </tr>
          </thead>
          <tbody>
            {INTEGRATIONS.map((i) => (
              <TR key={i.name}>
                <TD className="font-medium text-ink whitespace-nowrap">{i.name}</TD>
                <TD className="text-ink-soft">{i.purpose}</TD>
                <TD className="u-num text-ink-muted whitespace-nowrap">{i.env}</TD>
                <TD align="right"><Pill tone="slate">Not reported</Pill></TD>
              </TR>
            ))}
          </tbody>
        </Table>
        <p className="text-[11.5px] text-ink-soft mt-3 pt-3 border-t border-rule">
          Live status needs a <span className="u-num">GET /admin/api/settings/integrations</span>{' '}
          endpoint returning a configured/reachable flag per service. Not built yet.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <SectionHeader
        title="Rental Plan Pricing"
        hint={`${rows.length} plans across ${models.length} models. Edit plans from Vehicles & Fleet.`}
      />
      {rows.length === 0 ? (
        <EmptyState title="No rental plans" hint="Add a model with plans from Vehicles & Fleet." />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Model</TH>
              <TH>Category</TH>
              <TH>Duration</TH>
              <TH align="right">Rent</TH>
              <TH align="right">Deposit</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <TR key={r.id}>
                <TD className="font-medium text-ink whitespace-nowrap">{r.model}</TD>
                <TD className="text-ink-soft whitespace-nowrap">{r.category}</TD>
                <TD className="text-ink-muted whitespace-nowrap">{r.duration}</TD>
                <TD align="right"><Amount value={r.price} /></TD>
                <TD align="right" className="text-ink-muted">
                  {r.deposit ? <Amount value={r.deposit} /> : '—'}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
};
