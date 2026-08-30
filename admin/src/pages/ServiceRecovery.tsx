import React, { useState } from 'react';
import { Wrench, Truck, MapPin } from 'lucide-react';

export const ServiceRecovery: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'service' | 'recovery'>('service');

  const serviceTickets = [
    {
      id: 'SRV-102',
      bike: 'SPRINTO HS (TS09EV3004)',
      hub: 'Kondapur Main Hub',
      issue: 'Brake pad replacement & tire pressure inspection',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      technician: 'Raju Mechanic',
      date: 'Today, 11:30 AM',
    },
    {
      id: 'SRV-101',
      bike: 'ODYSSEY (TS09EV3019)',
      hub: 'Hitech City Station',
      issue: 'Battery connector cleaning & firmware diagnostics',
      priority: 'NORMAL',
      status: 'COMPLETED',
      technician: 'Kiran EV Tech',
      date: 'Yesterday',
    },
  ];

  const recoveryRequests = [
    {
      id: 'REC-55',
      rider: 'Anil Reddy (+91 9887766554)',
      bike: 'HALA CKD (TS09EV3009)',
      location: 'Near Inorbit Mall Flyover, Hitech City',
      issue: 'Flat rear tire on delivery route',
      dispatch: 'En Route (ETA 12 mins)',
      status: 'DISPATCHED',
      van: 'Van #02 (Driver: Suresh)',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Sub tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('service')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'service'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Service & Job Cards ({serviceTickets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('recovery')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'recovery'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Roadside Recovery SOS ({recoveryRequests.length})</span>
        </button>
      </div>

      {activeTab === 'service' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {serviceTickets.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    {t.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      t.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">{t.bike}</h4>
                <p className="text-xs text-slate-600 mb-3">{t.issue}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Tech: {t.technician}</span>
                <span>{t.hub}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {recoveryRequests.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {r.id} • SOS ROAD RECOVERY
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {r.dispatch}
                </span>
              </div>

              <h4 className="text-sm font-bold text-slate-900 mt-2">{r.rider}</h4>
              <p className="text-xs text-slate-700 mt-1 font-semibold">{r.bike} • {r.issue}</p>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{r.location}</span>
              </p>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Assigned: <strong className="text-slate-900">{r.van}</strong></span>
                <button className="px-3 py-1 bg-emerald-700 text-white rounded-lg font-bold text-xs hover:bg-emerald-800 transition">
                  Mark Resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

