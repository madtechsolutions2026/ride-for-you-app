import React, { useEffect, useState } from 'react';
import { Bike, Plus, BatteryCharging } from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Pill, toneFor, Btn, Modal, Field, input, rupees, Loader, EmptyState } from '../components/ui';

type Tab = 'models' | 'units';

export const Fleet: React.FC = () => {
  const [tab, setTab] = useState<Tab>('units');
  const [models, setModels] = useState<any[]>([]);
  const [bikes, setBikes] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | 'addBike' | 'addModel' | { editBike: any }>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/api/fleet');
      setModels(res.data.models || []);
      setBikes(res.data.bikes || []);
      setHubs(res.data.hubs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const submitBike = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (modal === 'addBike') {
        await apiClient.post('/admin/api/fleet/bikes', {
          modelId: f.get('modelId'),
          hubId: f.get('hubId'),
          registrationNumber: f.get('registrationNumber'),
          colour: f.get('colour') || undefined,
          batteryPercent: Number(f.get('batteryPercent')) || 100,
        });
      } else if (modal && typeof modal === 'object' && 'editBike' in modal) {
        await apiClient.put(`/admin/api/fleet/bikes/${modal.editBike.id}`, {
          status: f.get('status'),
          hubId: f.get('hubId'),
          batteryPercent: Number(f.get('batteryPercent')),
          colour: f.get('colour') || undefined,
        });
      }
      setModal(null);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const submitModel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const mres = await apiClient.post('/admin/api/fleet/models', {
        name: f.get('name'),
        category: f.get('category'),
        topSpeedKmph: Number(f.get('topSpeedKmph')),
        rangeKm: Number(f.get('rangeKm')),
        requiresLicense: f.get('requiresLicense') === 'on',
        chargerIncluded: f.get('chargerIncluded') === 'on',
      });
      const modelId = mres.data.model.id;
      // optional week plan
      const price = Number(f.get('weekPrice'));
      if (price > 0) {
        await apiClient.post('/admin/api/fleet/plans', {
          modelId,
          duration: 'WEEK',
          price,
          deposit: Number(f.get('deposit')) || 0,
        });
      }
      setModal(null);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader />;

  const counts = {
    total: bikes.length,
    available: bikes.filter((b) => b.status === 'AVAILABLE').length,
    rented: bikes.filter((b) => b.status === 'RENTED').length,
    maint: bikes.filter((b) => b.status === 'MAINTENANCE').length,
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          ['Total bikes', counts.total, 'slate'],
          ['Available', counts.available, 'green'],
          ['On rent', counts.rented, 'amber'],
          ['Maintenance', counts.maint, 'red'],
        ].map(([label, n, tone]) => (
          <Card key={label as string} className="p-4">
            <div className="text-[11px] font-bold text-[#8A97A0] uppercase">{label}</div>
            <div className="text-2xl font-extrabold text-[#172B3A] mt-0.5">{n as number}</div>
            <Pill tone={tone as any}>{label}</Pill>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['units', 'models'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold capitalize transition ${
                tab === t
                  ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                  : 'bg-white text-[#8A97A0] border border-[#EDF2F1] shadow-neo-sm'
              }`}
            >
              {t === 'units' ? `Physical bikes (${bikes.length})` : `Models (${models.length})`}
            </button>
          ))}
        </div>
        <Btn variant="primary" onClick={() => setModal(tab === 'units' ? 'addBike' : 'addModel')}>
          <Plus className="w-3.5 h-3.5" /> {tab === 'units' ? 'Add Bike' : 'Add Model'}
        </Btn>
      </div>

      {tab === 'units' && (
        <Card>
          {bikes.length === 0 ? (
            <EmptyState icon={<Bike className="w-8 h-8 mx-auto text-[#CBD5E1]" />} title="No bikes in the fleet" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                  <th className="px-5 py-3">Reg no.</th>
                  <th className="px-5 py-3">Model</th>
                  <th className="px-5 py-3">Hub</th>
                  <th className="px-5 py-3">Battery</th>
                  <th className="px-5 py-3">Odo</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bikes.map((b) => (
                  <tr key={b.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-5 py-3 font-extrabold text-[#172B3A]">{b.registrationNumber}</td>
                    <td className="px-5 py-3 text-xs text-[#475569]">
                      {b.model?.name}
                      <span className="text-[#8A97A0]"> · {b.model?.category}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#475569]">{b.hub?.name}</td>
                    <td className="px-5 py-3 text-xs">
                      <span className="inline-flex items-center gap-1 font-bold text-[#475569]">
                        <BatteryCharging className="w-3.5 h-3.5" /> {b.batteryPercent}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#8A97A0]">{b.odometerKm} km</td>
                    <td className="px-5 py-3">
                      <Pill tone={toneFor(b.status)}>{b.status}</Pill>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Btn onClick={() => setModal({ editBike: b })}>Edit</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'models' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-[#172B3A]">{m.name}</h3>
                  <p className="text-xs text-[#8A97A0]">
                    {m.category} · {m.topSpeedKmph} km/h · {m.rangeKm} km range
                  </p>
                </div>
                <Pill tone={toneFor(m.status)}>{m.status}</Pill>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(m.plans || []).map((p: any) => (
                  <Pill key={p.id} tone="blue">
                    {p.duration}: {rupees(p.price)}
                    {p.deposit ? ` +${rupees(p.deposit)} dep` : ''}
                  </Pill>
                ))}
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-3">
                {m._count?.bikes ?? 0} physical unit{(m._count?.bikes ?? 0) !== 1 ? 's' : ''}
                {m.requiresLicense ? ' · licence required' : ''}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* ---- Add / edit bike ---- */}
      {(modal === 'addBike' || (modal && typeof modal === 'object' && 'editBike' in modal)) && (
        <Modal
          title={modal === 'addBike' ? 'Add Physical Bike' : `Edit ${(modal as any).editBike.registrationNumber}`}
          onClose={() => setModal(null)}
        >
          <form onSubmit={submitBike} className="space-y-3.5">
            {modal === 'addBike' && (
              <>
                <Field label="Registration number">
                  <input name="registrationNumber" required placeholder="TS09EV1234" className={input} />
                </Field>
                <Field label="Model">
                  <select name="modelId" required className={input}>
                    <option value="">— pick a model —</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Hub">
              <select
                name="hubId"
                required
                defaultValue={modal && typeof modal === 'object' ? (modal as any).editBike.hubId : ''}
                className={input}
              >
                <option value="">— pick a hub —</option>
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Colour">
                <input
                  name="colour"
                  defaultValue={modal && typeof modal === 'object' ? (modal as any).editBike.colour || '' : ''}
                  className={input}
                />
              </Field>
              <Field label="Battery %">
                <input
                  name="batteryPercent"
                  type="number"
                  defaultValue={modal && typeof modal === 'object' ? (modal as any).editBike.batteryPercent : 100}
                  className={input}
                />
              </Field>
            </div>
            {modal && typeof modal === 'object' && 'editBike' in modal && (
              <Field label="Status">
                <select name="status" defaultValue={(modal as any).editBike.status} className={input}>
                  {['AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Btn type="button" onClick={() => setModal(null)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* ---- Add model ---- */}
      {modal === 'addModel' && (
        <Modal title="Add Bike Model" onClose={() => setModal(null)}>
          <form onSubmit={submitModel} className="space-y-3.5">
            <Field label="Model name">
              <input name="name" required placeholder="SPRINTO HS" className={input} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Category">
                <select name="category" className={input}>
                  <option value="SWAP">SWAP</option>
                  <option value="HOME">HOME</option>
                </select>
              </Field>
              <Field label="Top speed">
                <input name="topSpeedKmph" type="number" required className={input} />
              </Field>
              <Field label="Range km">
                <input name="rangeKm" type="number" required className={input} />
              </Field>
            </div>
            <div className="flex gap-4 text-xs font-semibold text-[#475569]">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requiresLicense" /> Licence required
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="chargerIncluded" /> Charger included
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#EDF2F1]">
              <Field label="Weekly price ₹ (optional)">
                <input name="weekPrice" type="number" className={input} />
              </Field>
              <Field label="Deposit ₹">
                <input name="deposit" type="number" className={input} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Btn type="button" onClick={() => setModal(null)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Create model'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
