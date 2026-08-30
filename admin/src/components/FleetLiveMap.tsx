import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Bike,
  Zap,
  MapPin,
  Battery,
  Radio,
  Navigation,
  Shield,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Volume2,
  Layers,
  Maximize2,
} from 'lucide-react';

// Sample Live Fleet IoT Telemetry Data across Hyderabad
const INITIAL_BIKES = [
  {
    id: 'bike-01',
    plate: 'TS09EV3001',
    model: 'SPRINTO HS',
    status: 'MOVING',
    speed: 38,
    battery: 88,
    voltage: '51.2V',
    temp: '32°C',
    rangeKm: 76,
    lat: 17.4486,
    lng: 17.4486 ? 78.3754 : 78.3754,
    rider: 'Madhu Kunchala',
    hub: 'Kondapur Main Hub',
    lastPing: '2s ago',
    signal: '4G LTE (5 bars)',
  },
  {
    id: 'bike-02',
    plate: 'TS09EV3004',
    model: 'NEW Aeroflow',
    status: 'PARKED',
    speed: 0,
    battery: 18,
    voltage: '46.8V',
    temp: '29°C',
    rangeKm: 14,
    lat: 17.4412,
    lng: 78.3845,
    rider: 'Vikram Singh',
    hub: 'Hitech City Station',
    lastPing: '5s ago',
    signal: '4G LTE (4 bars)',
  },
  {
    id: 'bike-03',
    plate: 'TS09EV3012',
    model: 'ODYSSEY HS',
    status: 'MOVING',
    speed: 42,
    battery: 64,
    voltage: '49.8V',
    temp: '34°C',
    rangeKm: 58,
    lat: 17.4325,
    lng: 78.3618,
    rider: 'Ramesh Reddy',
    hub: 'Gachibowli Hub',
    lastPing: '1s ago',
    signal: '4G LTE (5 bars)',
  },
  {
    id: 'bike-04',
    plate: 'TS09EV3019',
    model: 'EVTRIC Low-Speed',
    status: 'AVAILABLE',
    speed: 0,
    battery: 100,
    voltage: '52.4V',
    temp: '26°C',
    rangeKm: 90,
    lat: 17.4568,
    lng: 78.3689,
    rider: 'Unassigned (Ready)',
    hub: 'Kondapur Main Hub',
    lastPing: 'Just now',
    signal: '4G LTE (5 bars)',
  },
  {
    id: 'bike-05',
    plate: 'TS09EV3022',
    model: 'HALA CKD',
    status: 'MOVING',
    speed: 29,
    battery: 45,
    voltage: '48.5V',
    temp: '31°C',
    rangeKm: 40,
    lat: 17.4289,
    lng: 78.3889,
    rider: 'Suresh Kumar',
    hub: 'Hitech City Station',
    lastPing: '3s ago',
    signal: '4G LTE (4 bars)',
  },
  {
    id: 'bike-06',
    plate: 'TS09EV3030',
    model: 'SPRINTO HS',
    status: 'PARKED',
    speed: 0,
    battery: 14,
    voltage: '45.9V',
    temp: '28°C',
    rangeKm: 11,
    lat: 17.4512,
    lng: 78.3541,
    rider: 'Kiran Verma',
    hub: 'Kondapur Main Hub',
    lastPing: '8s ago',
    signal: '4G LTE (3 bars)',
  },
];

const INITIAL_HUBS = [
  {
    id: 'hub-01',
    name: 'Kondapur Main EV Hub',
    address: 'Botanical Garden Rd, Kondapur',
    city: 'Hyderabad',
    lat: 17.4588,
    lng: 78.3621,
    availableBikes: 18,
    totalBikes: 24,
    openTime: '09:00 - 21:00',
    contact: '+91 40 4567 8901',
  },
  {
    id: 'hub-02',
    name: 'Hitech City Deployment Center',
    address: 'Cyber Towers Junction, Hitech City',
    city: 'Hyderabad',
    lat: 17.4468,
    lng: 78.3792,
    availableBikes: 14,
    totalBikes: 18,
    openTime: '08:00 - 22:00',
    contact: '+91 40 4567 8902',
  },
  {
    id: 'hub-03',
    name: 'Gachibowli Operations Hub',
    address: 'Near DLF Cybercity, Gachibowli',
    city: 'Hyderabad',
    lat: 17.4342,
    lng: 78.3589,
    availableBikes: 10,
    totalBikes: 12,
    openTime: '09:00 - 21:00',
    contact: '+91 40 4567 8903',
  },
];

const INITIAL_SWAP_STATIONS = [
  {
    id: 'swap-01',
    name: 'Mindspace 2-Min Swap Dock',
    address: 'Mindspace Circle, Madhapur',
    lat: 17.4419,
    lng: 78.3812,
    chargedBatteries: 14,
    totalDocks: 16,
    status: 'ONLINE',
  },
  {
    id: 'swap-02',
    name: 'IKEA Battery Exchange Point',
    address: 'Near IKEA Junction, Raidurg',
    lat: 17.4378,
    lng: 78.3719,
    chargedBatteries: 11,
    totalDocks: 12,
    status: 'ONLINE',
  },
  {
    id: 'swap-03',
    name: 'Jubilee Hills Checkpost Dock',
    address: 'Road No. 36, Jubilee Hills',
    lat: 17.4312,
    lng: 78.4068,
    chargedBatteries: 8,
    totalDocks: 10,
    status: 'ONLINE',
  },
  {
    id: 'swap-04',
    name: 'Financial District Fast Swap',
    address: 'Wipro Circle, Nanakramguda',
    lat: 17.4198,
    lng: 78.3482,
    chargedBatteries: 15,
    totalDocks: 16,
    status: 'ONLINE',
  },
];

type FilterCategory = 'ALL' | 'MOVING' | 'PARKED' | 'LOW_BATTERY' | 'HUBS' | 'SWAP_STATIONS';

export const FleetLiveMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Centered on Hyderabad Hitech / Madhapur Hub belt
    const map = L.map(mapContainerRef.current, {
      center: [17.4435, 78.375],
      zoom: 13,
      zoomControl: false,
    });

    // Modern light tiles matching the #FBFBFD mobile UI
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers based on Filter and Search
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Render EV Hubs
    if (activeFilter === 'ALL' || activeFilter === 'HUBS') {
      INITIAL_HUBS.forEach((hub) => {
        if (
          searchQuery &&
          !hub.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !hub.address.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return;
        }

        const hubIcon = L.divIcon({
          className: 'custom-hub-marker',
          html: `
            <div style="
              background: #18B878;
              color: white;
              padding: 6px 10px;
              border-radius: 9999px;
              border: 3px solid white;
              box-shadow: 0 4px 14px rgba(24, 184, 120, 0.45);
              font-family: 'Poppins', sans-serif;
              font-size: 10px;
              font-weight: 800;
              display: flex;
              align-items: center;
              gap: 5px;
              cursor: pointer;
              white-space: nowrap;
              transform: translate(-50%, -50%);
            ">
              <span style="font-size: 12px;">🏢</span>
              <span>${hub.name.split(' ')[0]} Hub (${hub.availableBikes})</span>
            </div>
          `,
          iconSize: [0, 0],
        });

        const marker = L.marker([hub.lat, hub.lng], { icon: hubIcon });
        marker.on('click', () => {
          setSelectedEntity({ ...hub, type: 'HUB' });
          map.panTo([hub.lat, hub.lng]);
        });
        group.addLayer(marker);
      });
    }

    // 2. Render Swap Stations
    if (activeFilter === 'ALL' || activeFilter === 'SWAP_STATIONS') {
      INITIAL_SWAP_STATIONS.forEach((station) => {
        if (
          searchQuery &&
          !station.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return;
        }

        const swapIcon = L.divIcon({
          className: 'custom-swap-marker',
          html: `
            <div style="
              background: #0284C7;
              color: white;
              padding: 5px 9px;
              border-radius: 9999px;
              border: 3px solid white;
              box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
              font-family: 'Poppins', sans-serif;
              font-size: 10px;
              font-weight: 800;
              display: flex;
              align-items: center;
              gap: 4px;
              cursor: pointer;
              white-space: nowrap;
              transform: translate(-50%, -50%);
            ">
              <span>⚡</span>
              <span>${station.chargedBatteries}/${station.totalDocks} Swaps</span>
            </div>
          `,
          iconSize: [0, 0],
        });

        const marker = L.marker([station.lat, station.lng], { icon: swapIcon });
        marker.on('click', () => {
          setSelectedEntity({ ...station, type: 'SWAP_STATION' });
          map.panTo([station.lat, station.lng]);
        });
        group.addLayer(marker);
      });
    }

    // 3. Render IoT GPS Bikes
    INITIAL_BIKES.forEach((bike) => {
      if (activeFilter === 'MOVING' && bike.status !== 'MOVING') return;
      if (activeFilter === 'PARKED' && bike.status !== 'PARKED') return;
      if (activeFilter === 'LOW_BATTERY' && bike.battery >= 20) return;
      if (
        searchQuery &&
        !bike.plate.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !bike.model.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !bike.rider.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return;
      }

      const isLowBattery = bike.battery < 20;
      const isMoving = bike.status === 'MOVING';

      const pinColor = isLowBattery ? '#EF4444' : isMoving ? '#18B878' : '#172B3A';
      const batteryBg = isLowBattery ? '#FEE2E2' : '#E9F7F1';
      const batteryText = isLowBattery ? '#EF4444' : '#129461';

      const bikeIcon = L.divIcon({
        className: 'custom-bike-marker',
        html: `
          <div style="
            background: white;
            color: #172B3A;
            padding: 4px 8px;
            border-radius: 12px;
            border: 2px solid ${pinColor};
            box-shadow: 0 6px 18px rgba(23, 43, 58, 0.18);
            font-family: 'Poppins', sans-serif;
            font-size: 10px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            white-space: nowrap;
            transform: translate(-50%, -50%);
          ">
            <div style="
              width: 7px;
              height: 7px;
              border-radius: 9999px;
              background: ${pinColor};
              ${isMoving ? 'animation: pulse 1.5s infinite;' : ''}
            "></div>
            <span>${bike.plate}</span>
            <span style="
              background: ${batteryBg};
              color: ${batteryText};
              padding: 1px 5px;
              border-radius: 6px;
              font-size: 9px;
              font-weight: 800;
            ">${bike.battery}%</span>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([bike.lat, bike.lng], { icon: bikeIcon });
      marker.on('click', () => {
        setSelectedEntity({ ...bike, type: 'BIKE' });
        map.panTo([bike.lat, bike.lng]);
      });
      group.addLayer(marker);
    });
  }, [activeFilter, searchQuery]);

  const handleTriggerCommand = (cmdName: string) => {
    setCommandFeedback(`Executing IoT command "${cmdName}" on ${selectedEntity?.plate}...`);
    setTimeout(() => {
      setCommandFeedback(`✓ Command "${cmdName}" acknowledged by onboard ECU.`);
      setTimeout(() => setCommandFeedback(null), 3000);
    }, 1200);
  };

  return (
    <div className="bg-white rounded-3xl border border-[#EDF2F1] shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col relative">
      {/* Top Stylish IoT Control Header */}
      <div className="p-4 sm:p-5 border-b border-[#EDF2F1] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white/95 backdrop-blur-sm z-10">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E9F7F1] text-[#18B878] flex items-center justify-center">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#172B3A] tracking-tight flex items-center gap-2">
                <span>Live GPS Fleet & IoT Battery Telemetry</span>
                <span className="text-[10px] font-bold text-[#129461] bg-[#E9F7F1] px-2.5 py-0.5 rounded-full border border-[#DCF0E6]">
                  ● 54 Units Active
                </span>
              </h3>
              <p className="text-xs text-[#8A97A0] font-medium mt-0.5">
                Real-time tracking of EV vehicles, battery swapping stations, and operational hubs.
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Quick Search */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#8A97A0] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plate, rider, hub..."
              className="w-full bg-[#FBFBFD] border border-[#EDF2F1] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-[#172B3A] focus:outline-none focus:border-[#18B878] focus:ring-1 focus:ring-[#18B878]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                activeFilter === 'ALL'
                  ? 'bg-[#172B3A] text-white shadow-sm'
                  : 'bg-[#FBFBFD] text-[#8A97A0] hover:text-[#172B3A] border border-[#EDF2F1]'
              }`}
            >
              All Assets
            </button>

            <button
              onClick={() => setActiveFilter('MOVING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                activeFilter === 'MOVING'
                  ? 'bg-gradient-to-r from-[#1FAE72] to-[#129461] text-white shadow-sm'
                  : 'bg-[#FBFBFD] text-[#8A97A0] hover:text-[#172B3A] border border-[#EDF2F1]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#18B878]"></span>
              <span>Moving</span>
            </button>

            <button
              onClick={() => setActiveFilter('LOW_BATTERY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                activeFilter === 'LOW_BATTERY'
                  ? 'bg-[#EF4444] text-white shadow-sm'
                  : 'bg-[#FBFBFD] text-[#EF4444] hover:bg-[#FEE2E2] border border-[#FCA5A5]/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Low &lt;20%</span>
            </button>

            <button
              onClick={() => setActiveFilter('HUBS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                activeFilter === 'HUBS'
                  ? 'bg-[#18B878] text-white shadow-sm'
                  : 'bg-[#FBFBFD] text-[#8A97A0] hover:text-[#172B3A] border border-[#EDF2F1]'
              }`}
            >
              EV Hubs (3)
            </button>

            <button
              onClick={() => setActiveFilter('SWAP_STATIONS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                activeFilter === 'SWAP_STATIONS'
                  ? 'bg-[#0284C7] text-white shadow-sm'
                  : 'bg-[#FBFBFD] text-[#8A97A0] hover:text-[#172B3A] border border-[#EDF2F1]'
              }`}
            >
              ⚡ Swap Docks (4)
            </button>
          </div>
        </div>
      </div>

      {/* Map Body Container */}
      <div className="relative w-full h-[520px]">
        {/* Leaflet Mount Element */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Telemetry Stats Bar on the bottom left of map */}
        <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-[#EDF2F1] shadow-lg text-xs font-bold text-[#172B3A]">
          <div className="flex items-center gap-1.5">
            <Battery className="w-4 h-4 text-[#18B878]" />
            <span>Avg Fleet SoC: <strong className="text-[#129461]">78%</strong></span>
          </div>
          <span className="text-[#CBD6D6]">•</span>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#0284C7]" />
            <span>Swaps Today: <strong>89 Docks</strong></span>
          </div>
          <span className="text-[#CBD6D6]">•</span>
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#18B878]" />
            <span>IoT Uptime: <strong>99.9%</strong></span>
          </div>
        </div>

        {/* Right Floating Inspection Glass Drawer */}
        {selectedEntity && (
          <div className="absolute top-4 right-4 bottom-4 w-80 sm:w-96 bg-white/95 backdrop-blur-md rounded-2xl border border-[#EDF2F1] shadow-2xl p-5 z-20 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div>
              {/* Entity Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#EDF2F1]">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                      selectedEntity.type === 'BIKE'
                        ? 'bg-gradient-to-br from-[#1FAE72] to-[#129461]'
                        : selectedEntity.type === 'HUB'
                        ? 'bg-[#18B878]'
                        : 'bg-[#0284C7]'
                    }`}
                  >
                    {selectedEntity.type === 'BIKE' ? (
                      <Bike className="w-5 h-5" />
                    ) : selectedEntity.type === 'HUB' ? (
                      <MapPin className="w-5 h-5" />
                    ) : (
                      <Zap className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#172B3A] truncate">
                      {selectedEntity.plate || selectedEntity.name}
                    </h4>
                    <p className="text-xs text-[#8A97A0] font-medium">
                      {selectedEntity.model || selectedEntity.address}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEntity(null)}
                  className="w-7 h-7 rounded-full bg-[#F3FAF6] text-[#8A97A0] hover:text-[#172B3A] flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Specific Content for Bikes */}
              {selectedEntity.type === 'BIKE' && (
                <div className="mt-4 space-y-4 text-xs font-semibold text-[#172B3A]">
                  {/* Status & Speed */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 bg-[#FBFBFD] rounded-xl border border-[#EDF2F1]">
                      <span className="text-[10px] text-[#8A97A0] uppercase font-bold">IoT GPS State</span>
                      <p className="text-xs font-extrabold mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            selectedEntity.status === 'MOVING'
                              ? 'bg-[#18B878] animate-ping'
                              : 'bg-[#172B3A]'
                          }`}
                        />
                        <span>{selectedEntity.status} ({selectedEntity.speed} km/h)</span>
                      </p>
                    </div>

                    <div className="p-3 bg-[#FBFBFD] rounded-xl border border-[#EDF2F1]">
                      <span className="text-[10px] text-[#8A97A0] uppercase font-bold">Battery SoC</span>
                      <p
                        className={`text-xs font-extrabold mt-0.5 ${
                          selectedEntity.battery < 20 ? 'text-[#EF4444]' : 'text-[#129461]'
                        }`}
                      >
                        {selectedEntity.battery}% ({selectedEntity.rangeKm} km Range)
                      </p>
                    </div>
                  </div>

                  {/* Telemetry Metrics */}
                  <div className="p-3.5 bg-[#FBFBFD] rounded-xl border border-[#EDF2F1] space-y-2 text-[11px]">
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>Assigned Rider:</span>
                      <strong className="text-[#172B3A]">{selectedEntity.rider}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>Station Base:</span>
                      <strong className="text-[#172B3A]">{selectedEntity.hub}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>Voltage & Cell Temp:</span>
                      <strong className="text-[#172B3A]">{selectedEntity.voltage} • {selectedEntity.temp}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>GPS Coordinates:</span>
                      <span className="font-mono text-[#172B3A]">{selectedEntity.lat.toFixed(4)}, {selectedEntity.lng.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>IoT Signal:</span>
                      <strong className="text-[#129461]">{selectedEntity.signal}</strong>
                    </div>
                  </div>

                  {/* Remote ECU Commands */}
                  <div>
                    <h5 className="text-[11px] font-bold text-[#8A97A0] uppercase tracking-wider mb-2">
                      Remote IoT Hardware Commands
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTriggerCommand('Immobilize / Lock')}
                        className="py-2.5 px-3 rounded-xl bg-[#FEE2E2] text-[#EF4444] font-bold text-xs hover:bg-[#FCA5A5]/30 transition flex items-center justify-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Immobilize</span>
                      </button>

                      <button
                        onClick={() => handleTriggerCommand('Sound Alert Buzzer')}
                        className="py-2.5 px-3 rounded-xl bg-[#E9F7F1] text-[#129461] font-bold text-xs hover:bg-[#DCF0E6] transition flex items-center justify-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Sound Horn</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Specific Content for Hubs */}
              {selectedEntity.type === 'HUB' && (
                <div className="mt-4 space-y-3 text-xs font-semibold text-[#172B3A]">
                  <div className="p-3.5 bg-[#E9F7F1] rounded-xl border border-[#DCF0E6] text-center">
                    <span className="text-[10px] text-[#129461] uppercase font-bold">Ready Inventory</span>
                    <h3 className="text-xl font-extrabold text-[#129461] mt-0.5">
                      {selectedEntity.availableBikes} / {selectedEntity.totalBikes} Vehicles Ready
                    </h3>
                  </div>

                  <div className="p-3.5 bg-[#FBFBFD] rounded-xl border border-[#EDF2F1] space-y-2 text-[11px]">
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>Operating Hours:</span>
                      <strong className="text-[#172B3A]">{selectedEntity.openTime}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>Contact Desk:</span>
                      <strong className="text-[#172B3A] font-mono">{selectedEntity.contact}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>Location:</span>
                      <span className="text-[#172B3A] truncate">{selectedEntity.address}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Specific Content for Swap Stations */}
              {selectedEntity.type === 'SWAP_STATION' && (
                <div className="mt-4 space-y-3 text-xs font-semibold text-[#172B3A]">
                  <div className="p-3.5 bg-[#E0F2FE] rounded-xl border border-[#BAE6FD] text-center">
                    <span className="text-[10px] text-[#0284C7] uppercase font-bold">Charged Swap Inventory</span>
                    <h3 className="text-xl font-extrabold text-[#0284C7] mt-0.5">
                      {selectedEntity.chargedBatteries} / {selectedEntity.totalDocks} Batteries Ready
                    </h3>
                  </div>

                  <div className="p-3.5 bg-[#FBFBFD] rounded-xl border border-[#EDF2F1] space-y-2 text-[11px]">
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>Dock Status:</span>
                      <span className="inline-flex items-center gap-1 font-bold text-[#16A34A]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Automated Fast Swap Active</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#8A97A0]">
                      <span>Swap Duration:</span>
                      <strong className="text-[#172B3A]">~90 Seconds / Swap</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Command Feedback message */}
            {commandFeedback && (
              <div className="mt-3 p-2.5 rounded-xl bg-[#172B3A] text-white text-[11px] font-semibold text-center animate-in fade-in">
                {commandFeedback}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

