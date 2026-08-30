import React, { useState } from 'react';
import {
  Bike,
  Battery,
  MapPin,
  Plus,
  Zap,
  Activity,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const Fleet: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'models' | 'units'>('models');
  const [searchQuery, setSearchQuery] = useState('');

  const bikeModels = [
    {
      id: 'model-1',
      name: 'SPRINTO HS',
      category: 'High-Speed Commercial',
      topSpeed: '65 km/h',
      range: '120 km',
      batteryCapacity: '2.4 kWh Dual Swappable',
      weeklyPrice: '₹1,925',
      platformFee: '₹1,500',
      totalBikes: 24,
      availableBikes: 18,
      image: '/assets/vehicle-s1.png',
      status: 'ACTIVE',
    },
    {
      id: 'model-2',
      name: 'NEW AEROFLOW PRO',
      category: 'Dual Battery Long-Range',
      topSpeed: '70 km/h',
      range: '140 km',
      batteryCapacity: '3.0 kWh Dual Swappable',
      weeklyPrice: '₹2,200',
      platformFee: '₹1,500',
      totalBikes: 18,
      availableBikes: 14,
      image: '/assets/vehiclex1.png',
      status: 'ACTIVE',
    },
    {
      id: 'model-3',
      name: 'ODYSSEY MAX',
      category: 'Heavy-Duty Cargo Carrier',
      topSpeed: '55 km/h',
      range: '110 km',
      batteryCapacity: '2.0 kWh Fast Swap',
      weeklyPrice: '₹1,750',
      platformFee: '₹1,500',
      totalBikes: 12,
      availableBikes: 10,
      image: '/assets/vehiclez1.png',
      status: 'ACTIVE',
    },
  ];

  const vehicleUnits = [
    {
      plate: 'TS09EV3001',
      model: 'SPRINTO HS',
      hub: 'Kondapur Main Hub',
      battery: 88,
      status: 'RENTED',
      rider: 'Madhu Kunchala',
      odometer: '1,420 km',
      lastPing: '2s ago',
    },
    {
      plate: 'TS09EV3004',
      model: 'NEW AEROFLOW PRO',
      hub: 'Hitech City Station',
      battery: 18,
      status: 'RENTED',
      rider: 'Vikram Singh',
      odometer: '980 km',
      lastPing: '5s ago',
    },
    {
      plate: 'TS09EV3012',
      model: 'ODYSSEY MAX',
      hub: 'Gachibowli Hub',
      battery: 64,
      status: 'RENTED',
      rider: 'Ramesh Reddy',
      odometer: '2,150 km',
      lastPing: '1s ago',
    },
    {
      plate: 'TS09EV3019',
      model: 'SPRINTO HS',
      hub: 'Kondapur Main Hub',
      battery: 100,
      status: 'AVAILABLE',
      rider: 'Unassigned (Ready)',
      odometer: '430 km',
      lastPing: 'Just now',
    },
    {
      plate: 'TS09EV3022',
      model: 'NEW AEROFLOW PRO',
      hub: 'Hitech City Station',
      battery: 45,
      status: 'RENTED',
      rider: 'Suresh Kumar',
      odometer: '1,870 km',
      lastPing: '3s ago',
    },
    {
      plate: 'TS09EV3030',
      model: 'SPRINTO HS',
      hub: 'Kondapur Main Hub',
      battery: 14,
      status: 'AVAILABLE',
      rider: 'Unassigned (Charging)',
      odometer: '3,210 km',
      lastPing: '8s ago',
    },
  ];

  const filteredUnits = vehicleUnits.filter(
    (u) =>
      u.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.rider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-[#172B3A] tracking-tight">
            Fleet & Vehicle Inventory Management
          </h3>
          <p className="text-xs text-[#8A97A0] font-medium">
            Manage EV bike models, battery configurations, pricing plans, and physical fleet units.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub Navigation Pills */}
          <div className="p-1 bg-[#F8F7FD] rounded-2xl border border-[#EDF2F1] shadow-neo-sm flex items-center gap-1">
            <button
              onClick={() => setActiveTab('models')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'models'
                  ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                  : 'text-[#8A97A0] hover:text-[#172B3A]'
              }`}
            >
              Vehicle Models (3)
            </button>
            <button
              onClick={() => setActiveTab('units')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'units'
                  ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                  : 'text-[#8A97A0] hover:text-[#172B3A]'
              }`}
            >
              Live Fleet Units (54)
            </button>
          </div>

          <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white font-extrabold text-xs shadow-neo-btn hover:opacity-95 transition">
            <Plus className="w-4 h-4" />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      {activeTab === 'models' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {bikeModels.map((model) => (
            <div
              key={model.id}
              className="bg-white rounded-3xl p-5 border border-[#EDF2F1] shadow-neo hover:scale-[1.01] transition duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Vehicle Image Container with Inset Neumorphism */}
                <div className="w-full h-48 bg-[#F8F7FD] rounded-2xl p-4 border border-[#EDF2F1] flex items-center justify-center overflow-hidden mb-4 shadow-neo-inset">
                  <img
                    src={model.image}
                    alt={model.name}
                    className="max-h-full max-w-full object-contain hover:scale-105 transition duration-300"
                  />
                </div>

                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-base font-extrabold text-[#172B3A]">{model.name}</h4>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#EAF8F1] text-[#38A169] border border-[#C8F0DC]">
                    {model.status}
                  </span>
                </div>
                <p className="text-xs text-[#8A97A0] font-semibold mb-4">{model.category}</p>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-2.5 mb-4 text-xs font-semibold">
                  <div className="p-3 bg-[#F8F7FD] rounded-2xl border border-[#EDF2F1] shadow-neo-sm">
                    <span className="text-[10px] text-[#8A97A0] uppercase font-bold">Top Speed</span>
                    <p className="font-extrabold text-[#172B3A] mt-0.5">{model.topSpeed}</p>
                  </div>
                  <div className="p-3 bg-[#F8F7FD] rounded-2xl border border-[#EDF2F1] shadow-neo-sm">
                    <span className="text-[10px] text-[#8A97A0] uppercase font-bold">Max Range</span>
                    <p className="font-extrabold text-[#62CE90] mt-0.5">{model.range}</p>
                  </div>
                </div>

                <div className="p-3 bg-[#F8F7FD] rounded-2xl border border-[#EDF2F1] space-y-1.5 text-xs text-[#8A97A0] mb-4">
                  <div className="flex justify-between">
                    <span>Weekly Rent:</span>
                    <strong className="text-[#172B3A]">{model.weeklyPrice}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>One-Time Fee:</span>
                    <strong className="text-[#172B3A]">{model.platformFee}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Battery System:</span>
                    <strong className="text-[#172B3A]">{model.batteryCapacity}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#EDF2F1] flex items-center justify-between text-xs font-extrabold">
                <span className="text-[#8A97A0]">{model.totalBikes} Total Units</span>
                <span className="text-[#38A169] bg-[#EAF8F1] px-3 py-1 rounded-xl shadow-neo-sm">
                  {model.availableBikes} Ready for Rent
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[#EDF2F1] shadow-neo overflow-hidden">
          {/* Table Search */}
          <div className="p-4 border-b border-[#EDF2F1] bg-[#F8F7FD] flex items-center justify-between gap-4">
            <div className="relative w-full max-w-xs">
              <Search className="w-3.5 h-3.5 text-[#8A97A0] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search registration plate, rider, model..."
                className="w-full bg-white border border-[#EDF2F1] rounded-2xl pl-9 pr-3 py-2 text-xs font-semibold text-[#172B3A] focus:outline-none focus:border-[#62CE90] shadow-neo-sm"
              />
            </div>

            <div className="text-xs font-extrabold text-[#8A97A0]">
              Showing {filteredUnits.length} of {vehicleUnits.length} Fleet Bikes
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F7FD] border-b border-[#EDF2F1] text-[#8A97A0] font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-4 px-6">Registration Plate</th>
                  <th className="py-4 px-6">Vehicle Model</th>
                  <th className="py-4 px-6">Assigned Rider</th>
                  <th className="py-4 px-6">Current Base Hub</th>
                  <th className="py-4 px-6">Battery SoC</th>
                  <th className="py-4 px-6">Odometer</th>
                  <th className="py-4 px-6">Fleet Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F1] font-semibold text-[#172B3A]">
                {filteredUnits.map((u) => {
                  const isLow = u.battery < 20;
                  return (
                    <tr key={u.plate} className="hover:bg-[#F8F7FD] transition">
                      <td className="py-4 px-6 font-mono font-extrabold text-[#172B3A]">
                        {u.plate}
                      </td>
                      <td className="py-4 px-6 font-extrabold">{u.model}</td>
                      <td className="py-4 px-6 text-[#8A97A0]">
                        <strong className="text-[#172B3A]">{u.rider}</strong>
                      </td>
                      <td className="py-4 px-6 text-[#8A97A0]">{u.hub}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 font-extrabold px-2.5 py-0.5 rounded-full text-[11px] ${
                            isLow
                              ? 'bg-[#FEE2E2] text-[#EF4444]'
                              : 'bg-[#EAF8F1] text-[#38A169]'
                          }`}
                        >
                          <Battery className="w-3.5 h-3.5" />
                          <span>{u.battery}%</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-[#8A97A0]">{u.odometer}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold shadow-neo-sm ${
                            u.status === 'AVAILABLE'
                              ? 'bg-[#EAF8F1] text-[#38A169] border border-[#C8F0DC]'
                              : 'bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]'
                          }`}
                        >
                          {u.status === 'AVAILABLE' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Zap className="w-3 h-3" />
                          )}
                          <span>{u.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
