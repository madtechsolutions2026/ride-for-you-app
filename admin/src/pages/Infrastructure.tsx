import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Clock, Phone, Zap } from 'lucide-react';
import { apiClient } from '../api/client';

export const Infrastructure: React.FC = () => {
  const [data, setData] = useState<{ hubs: any[]; swapStations: any[] }>({ hubs: [], swapStations: [] });
  const [loading, setLoading] = useState(true);
  const [hubModalOpen, setHubModalOpen] = useState(false);
  const [stationModalOpen, setStationModalOpen] = useState(false);

  // New Hub State
  const [hubName, setHubName] = useState('');
  const [hubAddress, setHubAddress] = useState('');
  const [hubLat, setHubLat] = useState(17.45);
  const [hubLng, setHubLng] = useState(78.36);
  const [hubCity, setHubCity] = useState('Hyderabad');
  const [hubPhone, setHubPhone] = useState('+91 40 1234 5678');
  const [hubOpen, setHubOpen] = useState('09:00');
  const [hubClose, setHubClose] = useState('21:00');

  // New Swap Station State
  const [stName, setStName] = useState('');
  const [stAddress, setStAddress] = useState('');
  const [stLat, setStLat] = useState(17.44);
  const [stLng, setStLng] = useState(78.38);

  const fetchInfra = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/api/infrastructure');
      setData(res.data);
    } catch (e) {
      console.error('Error fetching infrastructure:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfra();
  }, []);

  const handleCreateHub = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/api/hubs', {
        name: hubName,
        address: hubAddress,
        lat: Number(hubLat),
        lng: Number(hubLng),
        city: hubCity,
        contactPhone: hubPhone,
        openTime: hubOpen,
        closeTime: hubClose,
      });
      setHubModalOpen(false);
      setHubName('');
      setHubAddress('');
      fetchInfra();
      alert('Hub added successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add hub');
    }
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/api/swap-stations', {
        name: stName,
        address: stAddress,
        lat: Number(stLat),
        lng: Number(stLng),
      });
      setStationModalOpen(false);
      setStName('');
      setStAddress('');
      fetchInfra();
      alert('Swap Station added successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add swap station');
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Hubs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">EV Main Hubs</h3>
            <p className="text-xs text-slate-500">Pick-up, drop-off, maintenance, and rider onboarding centers</p>
          </div>

          <button
            onClick={() => setHubModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add EV Hub</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {data.hubs.map((h) => (
            <div key={h.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {h.city}
                  </span>
                  <span className="text-xs font-bold text-slate-700">{h._count?.bikes || 0} Bikes</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">{h.name}</h4>
                <p className="text-xs text-slate-500 flex items-start gap-1.5 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{h.address}</span>
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{h.openTime} - {h.closeTime}</span>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{h.contactPhone}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Swap Stations Section */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">2-Minute Battery Swap Stations</h3>
            <p className="text-xs text-slate-500">Automated fast battery replacement points across city arteries</p>
          </div>

          <button
            onClick={() => setStationModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Swap Station</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {data.swapStations.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-blue-600" />
                    <span>Active Swap Point</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-700">Online</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">{s.name}</h4>
                <p className="text-xs text-slate-500 flex items-start gap-1.5 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{s.address}</span>
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{s.openTime} - {s.closeTime}</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {s.lat.toFixed(3)}, {s.lng.toFixed(3)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Hub Modal */}
      {hubModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create New EV Hub</h3>
            <p className="text-xs text-slate-500 mb-4">Add a new operational hub for bike collection and service.</p>

            <form onSubmit={handleCreateHub} className="space-y-3 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1">Hub Name</label>
                <input
                  type="text"
                  value={hubName}
                  onChange={(e) => setHubName(e.target.value)}
                  placeholder="e.g. Madhapur Tech Hub"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block mb-1">Full Street Address</label>
                <input
                  type="text"
                  value={hubAddress}
                  onChange={(e) => setHubAddress(e.target.value)}
                  placeholder="e.g. Near Metro Station, Madhapur, Hyderabad"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={hubLat}
                    onChange={(e) => setHubLat(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={hubLng}
                    onChange={(e) => setHubLng(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHubModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition"
                >
                  Create Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Swap Station Modal */}
      {stationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create Swap Station</h3>
            <p className="text-xs text-slate-500 mb-4">Deploy an automated battery swapping point.</p>

            <form onSubmit={handleCreateStation} className="space-y-3 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1">Station Name</label>
                <input
                  type="text"
                  value={stName}
                  onChange={(e) => setStName(e.target.value)}
                  placeholder="e.g. Mindspace Swap Dock"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block mb-1">Address / Landmark</label>
                <input
                  type="text"
                  value={stAddress}
                  onChange={(e) => setStAddress(e.target.value)}
                  placeholder="e.g. Mindspace Circle, Hitech City"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={stLat}
                    onChange={(e) => setStLat(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={stLng}
                    onChange={(e) => setStLng(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStationModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-700 text-white font-bold hover:bg-blue-800 transition"
                >
                  Create Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

