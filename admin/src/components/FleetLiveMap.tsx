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
  CheckCircle2,
  AlertTriangle,
  Lock,
  Volume2,
  Activity,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

export interface VehicleAsset {
  id: string;
  plate: string;
  model: string;
  category: 'High Speed' | 'Low Speed';
  status: 'MOVING' | 'PARKED' | 'AVAILABLE';
  speed: number;
  battery: number;
  voltage: string;
  temp: string;
  rangeKm: number;
  lat: number;
  lng: number;
  rider: string;
  hub: string;
  lastPing: string;
  odometerKm: number;
}

export interface HubAsset {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  availableBikes: number;
  totalBikes: number;
  openTime: string;
  contact: string;
}

export interface SwapStationAsset {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  chargedBatteries: number;
  totalDocks: number;
  status: 'ONLINE' | 'MAINTENANCE';
}

const FLEET_VEHICLES: VehicleAsset[] = [
  {
    id: 'bike-01',
    plate: 'TS09EV3001',
    model: 'SPRINTO HS',
    category: 'High Speed',
    status: 'MOVING',
    speed: 42,
    battery: 88,
    voltage: '51.2V',
    temp: '32°C',
    rangeKm: 76,
    lat: 17.4486,
    lng: 78.3754,
    rider: 'Madhu Kunchala',
    hub: 'Kondapur Main Hub',
    lastPing: '2s ago',
    odometerKm: 1420,
  },
  {
    id: 'bike-02',
    plate: 'TS09EV3004',
    model: 'NEW Aeroflow',
    category: 'High Speed',
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
    odometerKm: 980,
  },
  {
    id: 'bike-03',
    plate: 'TS09EV3012',
    model: 'ODYSSEY HS',
    category: 'High Speed',
    status: 'MOVING',
    speed: 38,
    battery: 64,
    voltage: '49.8V',
    temp: '34°C',
    rangeKm: 58,
    lat: 17.4325,
    lng: 78.3618,
    rider: 'Ramesh Reddy',
    hub: 'Gachibowli Hub',
    lastPing: '1s ago',
    odometerKm: 2150,
  },
  {
    id: 'bike-04',
    plate: 'TS09EV3019',
    model: 'EVTRIC Low-Speed',
    category: 'Low Speed',
    status: 'AVAILABLE',
    speed: 0,
    battery: 100,
    voltage: '52.4V',
    temp: '26°C',
    rangeKm: 90,
    lat: 17.4568,
    lng: 78.3689,
    rider: 'Unassigned (Available)',
    hub: 'Kondapur Main Hub',
    lastPing: 'Just now',
    odometerKm: 430,
  },
  {
    id: 'bike-05',
    plate: 'TS09EV3022',
    model: 'HALA CKD',
    category: 'Low Speed',
    status: 'MOVING',
    speed: 25,
    battery: 45,
    voltage: '48.5V',
    temp: '31°C',
    rangeKm: 40,
    lat: 17.4289,
    lng: 78.3889,
    rider: 'Suresh Kumar',
    hub: 'Hitech City Station',
    lastPing: '3s ago',
    odometerKm: 1870,
  },
  {
    id: 'bike-06',
    plate: 'TS09EV3030',
    model: 'SPRINTO HS',
    category: 'High Speed',
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
    odometerKm: 3210,
  },
];

const FLEET_HUBS: HubAsset[] = [
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
    name: 'Hitech City Deployment Hub',
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

const SWAP_STATIONS: SwapStationAsset[] = [
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

type TabType = 'VEHICLES' | 'HUBS' | 'SWAP_STATIONS';

export const FleetLiveMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<{ [key: string]: L.Marker }>({});

  const [activeTab, setActiveTab] = useState<TabType>('VEHICLES');
  const [selectedAsset, setSelectedAsset] = useState<any>(FLEET_VEHICLES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);

  // Initialize Map with Clean Free OpenStreetMap Tiles (NO Watermarks!)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [17.4435, 78.375],
      zoom: 13,
      zoomControl: false,
    });

    // Clean OpenStreetMap standard tile layer (100% Free, NO API Key, NO watermark)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markerMapRef.current = {};

    // 1. Plot EV Hubs
    FLEET_HUBS.forEach((hub) => {
      const isSelected = selectedAsset?.id === hub.id;
      const hubIcon = L.divIcon({
        className: 'hub-pin',
        html: `
          <div style="
            background: #129461;
            color: #FFFFFF;
            padding: 6px 12px;
            border-radius: 16px;
            border: ${isSelected ? '3px solid #172B3A' : '2px solid #FFFFFF'};
            box-shadow: 0 6px 16px rgba(18, 148, 97, 0.45);
            font-family: 'Poppins', sans-serif;
            font-size: 11px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            white-space: nowrap;
            transform: translate(-50%, -50%);
            transition: all 0.2s;
          ">
            <span style="font-size: 13px;">🏢</span>
            <span>${hub.name.split(' ')[0]} Hub</span>
            <span style="background: rgba(255,255,255,0.25); padding: 1px 6px; border-radius: 999px; font-size: 10px;">${hub.availableBikes} Bikes</span>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([hub.lat, hub.lng], { icon: hubIcon });
      marker.on('click', () => {
        setSelectedAsset({ ...hub, assetType: 'HUB' });
        setActiveTab('HUBS');
        map.flyTo([hub.lat, hub.lng], 14);
      });
      layerGroup.addLayer(marker);
      markerMapRef.current[hub.id] = marker;
    });

    // 2. Plot Swap Stations
    SWAP_STATIONS.forEach((station) => {
      const isSelected = selectedAsset?.id === station.id;
      const swapIcon = L.divIcon({
        className: 'swap-pin',
        html: `
          <div style="
            background: #0284C7;
            color: #FFFFFF;
            padding: 6px 10px;
            border-radius: 16px;
            border: ${isSelected ? '3px solid #172B3A' : '2px solid #FFFFFF'};
            box-shadow: 0 6px 16px rgba(2, 132, 199, 0.45);
            font-family: 'Poppins', sans-serif;
            font-size: 11px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
            white-space: nowrap;
            transform: translate(-50%, -50%);
          ">
            <span style="font-size: 13px;">⚡</span>
            <span>${station.chargedBatteries}/${station.totalDocks} Swaps</span>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([station.lat, station.lng], { icon: swapIcon });
      marker.on('click', () => {
        setSelectedAsset({ ...station, assetType: 'SWAP_STATION' });
        setActiveTab('SWAP_STATIONS');
        map.flyTo([station.lat, station.lng], 14);
      });
      layerGroup.addLayer(marker);
      markerMapRef.current[station.id] = marker;
    });

    // 3. Plot Vehicles
    FLEET_VEHICLES.forEach((bike) => {
      const isSelected = selectedAsset?.id === bike.id;
      const isLow = bike.battery < 20;
      const isMoving = bike.status === 'MOVING';

      const bgHeader = isLow ? '#EF4444' : isMoving ? '#18B878' : '#172B3A';

      const bikeIcon = L.divIcon({
        className: 'bike-pin',
        html: `
          <div style="
            background: #FFFFFF;
            color: #172B3A;
            border-radius: 14px;
            border: 2px solid ${bgHeader};
            box-shadow: 0 6px 18px rgba(23, 43, 58, 0.22);
            font-family: 'Poppins', sans-serif;
            display: flex;
            align-items: center;
            cursor: pointer;
            white-space: nowrap;
            transform: translate(-50%, -50%);
            overflow: hidden;
            font-size: 11px;
            font-weight: 700;
            ${isSelected ? 'transform: translate(-50%, -50%) scale(1.1); z-index: 999;' : ''}
          ">
            <div style="
              background: ${bgHeader};
              color: white;
              padding: 4px 7px;
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 10px;
              font-weight: 800;
            ">
              <span style="font-size: 11px;">🛵</span>
              <span>${bike.plate}</span>
            </div>
            <div style="
              padding: 3px 7px;
              display: flex;
              align-items: center;
              gap: 3px;
              font-weight: 800;
              color: ${isLow ? '#EF4444' : '#129461'};
              background: #F8FAFC;
            ">
              <span>${bike.battery}%</span>
              ${isMoving ? `<span style="font-size: 9px; color: #8A97A0;">• ${bike.speed}km/h</span>` : ''}
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([bike.lat, bike.lng], { icon: bikeIcon });
      marker.on('click', () => {
        setSelectedAsset({ ...bike, assetType: 'VEHICLE' });
        setActiveTab('VEHICLES');
        map.flyTo([bike.lat, bike.lng], 15);
      });
      layerGroup.addLayer(marker);
      markerMapRef.current[bike.id] = marker;
    });
  }, [selectedAsset]);

  const handleSelectAsset = (asset: any, type: TabType) => {
    setSelectedAsset({ ...asset, assetType: type === 'VEHICLES' ? 'VEHICLE' : type === 'HUBS' ? 'HUB' : 'SWAP_STATION' });
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([asset.lat, asset.lng], 15, { duration: 0.8 });
    }
  };

  const handleTriggerCommand = (cmd: string) => {
    setCommandFeedback(`Dispatching "${cmd}" to ${selectedAsset.plate}...`);
    setTimeout(() => {
      setCommandFeedback(`✓ Command confirmed by onboard IoT ECU.`);
      setTimeout(() => setCommandFeedback(null), 3000);
    }, 1000);
  };

  const filteredVehicles = FLEET_VEHICLES.filter(
    (b) =>
      b.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.rider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-3xl border border-[#EDF2F1] shadow-xl shadow-slate-200/50 overflow-hidden">
      {/* 1. Header Bar with Clear Legend */}
      <div className="p-5 border-b border-[#EDF2F1] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E9F7F1] text-[#18B878] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#172B3A] tracking-tight">
                Live Operations Map & IoT Telemetry
              </h3>
              <p className="text-xs font-medium text-[#8A97A0]">
                Real-time tracking of active EV bikes, 2-minute battery swap docks, and main hubs in Hyderabad
              </p>
            </div>
          </div>
        </div>

        {/* Clear Color-Coded Map Legend for Client */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E9F7F1] text-[#129461] border border-[#DCF0E6]">
            <span className="w-2 h-2 rounded-full bg-[#18B878]"></span>
            <span>On Road (Moving)</span>
          </span>

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] text-[#172B3A] border border-[#EDF2F1]">
            <span className="w-2 h-2 rounded-full bg-[#172B3A]"></span>
            <span>Parked / Ready</span>
          </span>

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEE2E2] text-[#EF4444] border border-[#FCA5A5]/60">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
            <span>Low Battery (&lt;20%)</span>
          </span>

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#DCF0E6] text-[#129461]">
            <span>🏢 EV Main Hub</span>
          </span>

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E0F2FE] text-[#0284C7]">
            <span>⚡ Battery Swap Dock</span>
          </span>
        </div>
      </div>

      {/* 2. Split Screen: Left Interactive Telemetry Explorer | Right Clear Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left Explorer (5 Cols) */}
        <div className="lg:col-span-4 border-r border-[#EDF2F1] flex flex-col bg-[#FBFBFD]">
          {/* Sub Navigation Tabs */}
          <div className="p-3 border-b border-[#EDF2F1] bg-white flex items-center gap-2">
            <button
              onClick={() => setActiveTab('VEHICLES')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'VEHICLES'
                  ? 'bg-[#18B878] text-white shadow-sm'
                  : 'bg-[#F8FAFC] text-[#8A97A0] hover:text-[#172B3A]'
              }`}
            >
              🛵 Bikes ({FLEET_VEHICLES.length})
            </button>

            <button
              onClick={() => setActiveTab('HUBS')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'HUBS'
                  ? 'bg-[#129461] text-white shadow-sm'
                  : 'bg-[#F8FAFC] text-[#8A97A0] hover:text-[#172B3A]'
              }`}
            >
              🏢 Hubs ({FLEET_HUBS.length})
            </button>

            <button
              onClick={() => setActiveTab('SWAP_STATIONS')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'SWAP_STATIONS'
                  ? 'bg-[#0284C7] text-white shadow-sm'
                  : 'bg-[#F8FAFC] text-[#8A97A0] hover:text-[#172B3A]'
              }`}
            >
              ⚡ Swaps ({SWAP_STATIONS.length})
            </button>
          </div>

          {/* Search Bar */}
          {activeTab === 'VEHICLES' && (
            <div className="p-3 border-b border-[#EDF2F1] bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8A97A0] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by plate, model, rider..."
                  className="w-full bg-[#FBFBFD] border border-[#EDF2F1] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-[#172B3A] focus:outline-none focus:border-[#18B878]"
                />
              </div>
            </div>
          )}

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[480px]">
            {activeTab === 'VEHICLES' &&
              filteredVehicles.map((bike) => {
                const isSelected = selectedAsset?.id === bike.id;
                const isLow = bike.battery < 20;
                return (
                  <div
                    key={bike.id}
                    onClick={() => handleSelectAsset(bike, 'VEHICLES')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#E9F7F1] border-[#18B878] shadow-sm'
                        : 'bg-white border-[#EDF2F1] hover:bg-[#F3FAF6]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-xs text-[#172B3A] bg-[#F8FAFC] px-2 py-0.5 rounded-lg border border-[#EDF2F1]">
                          {bike.plate}
                        </span>
                        <span className="text-[11px] font-bold text-[#172B3A]">{bike.model}</span>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isLow
                            ? 'bg-[#FEE2E2] text-[#EF4444]'
                            : bike.status === 'MOVING'
                            ? 'bg-[#DCF0E6] text-[#129461]'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {bike.status === 'MOVING' ? `⚡ ${bike.speed} km/h` : bike.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#8A97A0] font-medium mt-2">
                      <span>Rider: <strong className="text-[#172B3A]">{bike.rider}</strong></span>
                      <span
                        className={`font-bold flex items-center gap-1 ${
                          isLow ? 'text-[#EF4444]' : 'text-[#129461]'
                        }`}
                      >
                        <Battery className="w-3.5 h-3.5" />
                        <span>{bike.battery}% ({bike.rangeKm} km)</span>
                      </span>
                    </div>
                  </div>
                );
              })}

            {activeTab === 'HUBS' &&
              FLEET_HUBS.map((hub) => {
                const isSelected = selectedAsset?.id === hub.id;
                return (
                  <div
                    key={hub.id}
                    onClick={() => handleSelectAsset(hub, 'HUBS')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#E9F7F1] border-[#18B878] shadow-sm'
                        : 'bg-white border-[#EDF2F1] hover:bg-[#F3FAF6]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-[#172B3A] flex items-center gap-1.5">
                        <span>🏢</span>
                        <span>{hub.name}</span>
                      </h4>
                      <span className="text-[10px] font-extrabold text-[#129461] bg-[#DCF0E6] px-2 py-0.5 rounded-full">
                        {hub.availableBikes} Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8A97A0] truncate">{hub.address}</p>
                    <div className="mt-2 text-[10px] text-[#8A97A0] flex justify-between">
                      <span>Hours: {hub.openTime}</span>
                      <span className="font-mono text-[#172B3A]">{hub.contact}</span>
                    </div>
                  </div>
                );
              })}

            {activeTab === 'SWAP_STATIONS' &&
              SWAP_STATIONS.map((station) => {
                const isSelected = selectedAsset?.id === station.id;
                return (
                  <div
                    key={station.id}
                    onClick={() => handleSelectAsset(station, 'SWAP_STATIONS')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#E0F2FE] border-[#0284C7] shadow-sm'
                        : 'bg-white border-[#EDF2F1] hover:bg-[#F0F9FF]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-[#172B3A] flex items-center gap-1.5">
                        <span>⚡</span>
                        <span>{station.name}</span>
                      </h4>
                      <span className="text-[10px] font-extrabold text-[#0284C7] bg-[#E0F2FE] px-2 py-0.5 rounded-full">
                        {station.chargedBatteries}/{station.totalDocks} Swaps
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8A97A0] truncate">{station.address}</p>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right Map Canvas (7 Cols) */}
        <div className="lg:col-span-8 relative flex flex-col">
          {/* Leaflet Map Mount */}
          <div ref={mapContainerRef} className="w-full h-full min-h-[500px] z-0" />

          {/* Selected Asset Floating Detail Card at Bottom */}
          {selectedAsset && (
            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl border border-[#EDF2F1] shadow-2xl p-4 z-10 animate-in slide-in-from-bottom duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-sm ${
                      selectedAsset.plate
                        ? 'bg-gradient-to-br from-[#1FAE72] to-[#129461]'
                        : selectedAsset.totalBikes
                        ? 'bg-[#129461]'
                        : 'bg-[#0284C7]'
                    }`}
                  >
                    {selectedAsset.plate ? '🛵' : selectedAsset.totalBikes ? '🏢' : '⚡'}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#172B3A] flex items-center gap-2">
                      <span>{selectedAsset.plate || selectedAsset.name}</span>
                      {selectedAsset.status && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            selectedAsset.battery < 20
                              ? 'bg-[#FEE2E2] text-[#EF4444]'
                              : selectedAsset.status === 'MOVING'
                              ? 'bg-[#DCF0E6] text-[#129461]'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {selectedAsset.status} {selectedAsset.speed > 0 ? `(${selectedAsset.speed} km/h)` : ''}
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-[#8A97A0] font-medium">
                      {selectedAsset.model || selectedAsset.address}
                    </p>
                  </div>
                </div>

                {/* IoT Metrics / Controls for Bike */}
                {selectedAsset.plate ? (
                  <div className="flex items-center gap-2">
                    <div className="p-2 px-3 bg-[#FBFBFD] rounded-xl border border-[#EDF2F1] text-right">
                      <span className="text-[10px] text-[#8A97A0] font-bold uppercase">Battery SoC</span>
                      <p
                        className={`text-xs font-extrabold ${
                          selectedAsset.battery < 20 ? 'text-[#EF4444]' : 'text-[#129461]'
                        }`}
                      >
                        {selectedAsset.battery}% ({selectedAsset.rangeKm} km)
                      </p>
                    </div>

                    <button
                      onClick={() => handleTriggerCommand('Immobilize / Lock')}
                      className="py-2.5 px-3 rounded-xl bg-[#FEE2E2] text-[#EF4444] font-bold text-xs hover:bg-[#FCA5A5]/30 transition flex items-center gap-1"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock</span>
                    </button>

                    <button
                      onClick={() => handleTriggerCommand('Sound Alert Horn')}
                      className="py-2.5 px-3 rounded-xl bg-[#E9F7F1] text-[#129461] font-bold text-xs hover:bg-[#DCF0E6] transition flex items-center gap-1"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Horn</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-[#129461] font-bold bg-[#E9F7F1] px-3 py-2 rounded-xl">
                    {selectedAsset.availableBikes !== undefined
                      ? `✓ ${selectedAsset.availableBikes} Bikes Ready for Rent`
                      : `⚡ ${selectedAsset.chargedBatteries} Charged Docks Available`}
                  </div>
                )}
              </div>

              {commandFeedback && (
                <div className="mt-2.5 p-2 rounded-xl bg-[#172B3A] text-white text-xs font-semibold text-center animate-in fade-in">
                  {commandFeedback}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
