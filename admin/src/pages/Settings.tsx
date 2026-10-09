import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import {
  Card, SectionHeader, Table, TH, TD, TR, Pill, Amount, EmptyState, Loader, Btn, Modal, Field, input,
} from '../components/ui';

interface Plan {
  id: string;
  duration: string;
  price: number;
  deposit?: number;
  status?: string;
}

interface Integration {
  name: string;
  purpose: string;
  env: string;
  configured: boolean;
}

export const Settings: React.FC<{ tab?: 'pricing' | 'integrations' }> = ({ tab = 'pricing' }) => {
  const [models, setModels] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [paymentsMode, setPaymentsMode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const reloadFleet = async () => {
    try {
      const fleet = await apiClient.get('/admin/api/fleet');
      setModels(fleet.data.models || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Both tabs load together — the payloads are small and it keeps
        // switching between them instant.
        const [fleet, status] = await Promise.all([
          apiClient.get('/admin/api/fleet'),
          apiClient.get('/admin/api/settings/integrations').catch(() => null),
        ]);
        setModels(fleet.data.models || []);
        if (status) {
          setIntegrations(status.data.integrations ?? []);
          setPaymentsMode(status.data.paymentsMode ?? '');
        }
      } catch (e) {
        console.error('Error fetching settings:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSaving(true);
    try {
      await apiClient.post('/admin/api/fleet/plans', {
        modelId: editingPlan.modelId,
        duration: editingPlan.duration,
        price: Number(editingPlan.price),
        deposit: Number(editingPlan.deposit ?? 0),
        status: editingPlan.status || 'ACTIVE',
      });
      setEditingPlan(null);
      await reloadFleet();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to update plan pricing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  const rows = models.flatMap((m) =>
    (m.plans || []).map((p: Plan) => ({ modelId: m.id, model: m.name, category: m.category, ...p })),
  );

  if (tab === 'integrations') {
    return (
      <Card className="p-5">
        <SectionHeader
          title="Integrations"
          hint="Third-party services this deployment depends on. Credentials live in server environment variables and are never exposed to the dashboard."
        />
        {paymentsMode === 'stub' && (
          <div className="mb-4 border border-signal-amberLine bg-signal-amberSoft rounded-sm p-3">
            <p className="text-[12.5px] text-signal-amber">
              <strong>Payments are in stub mode.</strong> Bookings and weekly rent are marked paid
              and written to the ledger, but no gateway is called and no money moves. Set{' '}
              <span className="u-num">PAYMENTS_MODE=live</span> once gateway credentials are in
              place.
            </p>
          </div>
        )}

        {integrations === null ? (
          <EmptyState
            title="Status unavailable"
            hint="The server did not report integration configuration."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <TH>Service</TH>
                <TH>Purpose</TH>
                <TH>Configured by</TH>
                <TH align="right">Status</TH>
              </tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <TR key={i.name}>
                  <TD className="font-medium text-ink whitespace-nowrap">{i.name}</TD>
                  <TD className="text-ink-soft">{i.purpose}</TD>
                  <TD className="u-num text-ink-muted whitespace-nowrap">{i.env}</TD>
                  <TD align="right">
                    <Pill tone={i.configured ? 'green' : 'slate'}>
                      {i.configured ? 'Configured' : 'Not configured'}
                    </Pill>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}

        <p className="text-[11.5px] text-ink-soft mt-3 pt-3 border-t border-rule">
          "Configured" means the server holds credentials for that service. It does not call the
          provider to confirm they still work — that belongs in a health check, not a page load.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <SectionHeader
        title="Rental Plan Pricing"
        hint={`${rows.length} plans across ${models.length} models. Click 'Edit Price' to update rental rates or security deposits.`}
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
              <TH align="right">Actions</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <TR key={`${r.modelId}-${r.duration}`}>
                <TD className="font-medium text-ink whitespace-nowrap">{r.model}</TD>
                <TD className="text-ink-soft whitespace-nowrap">{r.category}</TD>
                <TD className="text-ink-muted whitespace-nowrap">{r.duration}</TD>
                <TD align="right"><Amount value={r.price} /></TD>
                <TD align="right" className="text-ink-muted">
                  {r.deposit ? <Amount value={r.deposit} /> : '—'}
                </TD>
                <TD align="right">
                  <Btn onClick={() => setEditingPlan(r)}>Edit Price</Btn>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {editingPlan && (
        <Modal
          title={`Edit Pricing — ${editingPlan.model} (${editingPlan.duration})`}
          onClose={() => setEditingPlan(null)}
        >
          <form onSubmit={handleSavePlan} className="space-y-4">
            <Field label="Duration">
              <input value={editingPlan.duration} disabled className={`${input} bg-rule-soft`} />
            </Field>
            <Field label="Rent Price (₹)">
              <input
                type="number"
                required
                min="1"
                value={editingPlan.price}
                onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                className={input}
              />
            </Field>
            <Field label="Security Deposit (₹)">
              <input
                type="number"
                min="0"
                value={editingPlan.deposit ?? 0}
                onChange={(e) => setEditingPlan({ ...editingPlan, deposit: Number(e.target.value) })}
                className={input}
              />
            </Field>
            <Field label="Status">
              <select
                value={editingPlan.status || 'ACTIVE'}
                onChange={(e) => setEditingPlan({ ...editingPlan, status: e.target.value })}
                className={input}
              >
                <option value="ACTIVE">ACTIVE (Visible in Rider Mobile App)</option>
                <option value="INACTIVE">INACTIVE (Hidden)</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-rule">
              <Btn type="button" onClick={() => setEditingPlan(null)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Price'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
};
