import React, { useState, useEffect } from 'react';
import { Bike, Plus, Battery, MapPin, Search, Filter, ShieldCheck, CheckCircle2, Wrench } from 'lucide-react';
import { apiClient } from '../api/client';

export const Fleet: React.FC = () => {
  const [fleetData, setFleetData] = useState<{ models: any[]; bikes: any[]; hubs: any[] }>({
    models: [],
    bikes: [],
    hubs: [],
  });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // New Bike form
  const [modelId, setModelId] = useState('');
  const [hubId, setHubId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [colour, setColour] = useState('Graphite Black');
  const [batteryPercent, setBatteryPercent] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  const fetchFleet = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/api/fleet');
      setFleetData(res.data);
      if (res.data?.models?.length > 0) setModelId(res.data.models[0].id);
      if (res.data?.hubs?.length > 0) setHubId(res.data.hubs[0].id);
    } catch (e) {
      console.error('Error fetching fleet:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const handleAddBike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationNumber.trim() || !modelId || !hubId) {
      alert('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/admin/api/fleet/bikes', {
        modelId,
        hubId,
        registrationNumber: registrationNumber.toUpperCase().trim(),
        colour,
        batteryPercent: Number(batteryPercent),
        status: 'AVAILABLE',
      });
      setModalOpen(false);
      setRegistrationNumber('');
      fetchFleet();
      alert('Vehicle successfully added to fleet!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add bike unit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Fleet Inventory & Physical Units</h3>
          <p className="text-xs text-slate-500">
            {fleetData.bikes.length} Total Vehicles across {fleetData.hubs.length} Active Hubs
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#0B6623] to-[#00C9A7] text-white rounded-xl text-xs font-bold hover:opacity-95 shadow-md shadow-emerald-950/40 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Physical Vehicle</span>
        </button>
      </div>

      {/* Models Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {fleetData.models.map((m) => (
          <div key={m.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              {m.category}
            </span>
            <h4 className="text-xs font-bold text-slate-900 mt-2 truncate">{m.name}</h4>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>{m.rangeKm} km Range</span>
              <span className="font-bold text-slate-900">{m._count?.bikes || 0} Units</span>
            </div>
          </div>
        ))}
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Registration Plate</th>
                <th className="py-3.5 px-6">Model</th>
                <th className="py-3.5 px-6">Assigned Hub</th>
                <th className="py-3.5 px-6">Battery Health</th>
                <th className="py-3.5 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Loading vehicle units...
                  </td>
                </tr>
              ) : fleetData.bikes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No physical vehicles found.
                  </td>
                </tr>
              ) : (
                fleetData.bikes.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-6">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                        {b.registrationNumber}
                      </span>
                    </td>

                    <td className="py-3.5 px-6">
                      <p className="font-bold text-slate-900">{b.model?.name || 'EV Bike'}</p>
                      <p className="text-[11px] text-slate-500">{b.colour}</p>
                    </td>

                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{b.hub?.name || 'Main Hub'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              b.batteryPercent > 50
                                ? 'bg-emerald-500'
                                : b.batteryPercent > 20
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${b.batteryPercent}%` }}
                          />
                        </div>
                        <span className="font-bold text-[11px] text-slate-800">{b.batteryPercent}%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'RENTED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Physical Vehicle Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add New Vehicle to Fleet</h3>
            <p className="text-xs text-slate-500 mb-4">Assign a physical license plate and deploy to a Hub.</p>

            <form onSubmit={handleAddBike} className="space-y-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1">Vehicle Model</label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {fleetData.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1">Assigned EV Hub</label>
                <select
                  value={hubId}
                  onChange={(e) => setHubId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {fleetData.hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} - {h.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1">Registration Plate (License #)</label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. TS09EV4001"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs uppercase font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Colour</label>
                  <input
                    type="text"
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    placeholder="e.g. Matte Black"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block mb-1">Battery Health %</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={batteryPercent}
                    onChange={(e) => setBatteryPercent(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#0B6623] to-[#00C9A7] text-white font-bold hover:opacity-95 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Deploy to Fleet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
