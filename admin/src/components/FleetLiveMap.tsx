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
  RotateCcw,
} from 'lucide-react';

export interface VehicleAsset {
  id: string;
  plate: string;
  model: string;
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
}

const FLEET_VEHICLES: VehicleAsset[] = [
  {
    id: 'bike-01',
    plate: 'TS09EV3001',
    model: 'SPRINTO HS',
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
  },
  {
    id: 'bike-02',
    plate: 'TS09EV3004',
    model: 'NEW AEROFLOW PRO',
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
  },
  {
    id: 'bike-03',
    plate: 'TS09EV3012',
    model: 'ODYSSEY MAX',
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
  },
  {
    id: 'bike-04',
    plate: 'TS09EV3019',
    model: 'SPRINTO HS',
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
  },
  {
    id: 'bike-05',
    plate: 'TS09EV3022',
    model: 'NEW AEROFLOW PRO',
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
  },
  {
    id: 'swap-02',
    name: 'IKEA Battery Exchange Point',
    address: 'Near IKEA Junction, Raidurg',
    lat: 17.4378,
    lng: 78.3719,
    chargedBatteries: 11,
    totalDocks: 12,
  },
  {
    id: 'swap-03',
    name: 'Jubilee Hills Checkpost Dock',
    address: 'Road No. 36, Jubilee Hills',
    lat: 17.4312,
    lng: 78.4068,
    chargedBatteries: 8,
    totalDocks: 10,
  },
  {
    id: 'swap-04',
    name: 'Financial District Fast Swap',
    address: 'Wipro Circle, Nanakramguda',
    lat: 17.4198,
    lng: 78.3482,
    chargedBatteries: 15,
    totalDocks: 16,
  },
];

type FilterType = 'ALL' | 'MOVING' | 'PARKED' | 'LOW_BATTERY' | 'HUBS' | 'SWAPS';

export const FleetLiveMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);

  // Initialize Map with Silky Clean Carto Light (Zero Watermarks)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [17.4435, 78.375],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
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

  // Plot Clean Neumorphic Markers with #62CE90
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Hub Markers
    if (activeFilter === 'ALL' || activeFilter === 'HUBS') {
      FLEET_HUBS.forEach((hub) => {
        const isSelected = selectedAsset?.id === hub.id;
        const icon = L.divIcon({
          className: 'custom-hub-pin',
          html: `
            <div style="
              display: inline-flex;
              align-items: center;
              background: #FFFFFF;
              border-radius: 9999px;
              padding: 4px 10px 4px 4px;
              box-shadow: 0 8px 20px rgba(98, 206, 144, 0.28);
              border: ${isSelected ? '2px solid #62CE90' : '1px solid #EDF2F1'};
              cursor: pointer;
              white-space: nowrap;
              font-family: 'Poppins', sans-serif;
              transform: translate(-50%, -50%);
              transition: all 0.2s ease;
            ">
              <div style="
                width: 26px;
                height: 26px;
                border-radius: 13px;
                background: #62CE90;
                color: #FFFFFF;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 800;
                margin-right: 6px;
                box-shadow: 0 2px 8px rgba(98, 206, 144, 0.45);
              ">🏢</div>
              <div style="display: flex; flex-direction: column; line-height: 1.1;">
                <span style="font-size: 11px; font-weight: 800; color: #172B3A;">${hub.name.split(' ')[0]} Hub</span>
                <span style="font-size: 9.5px; font-weight: 700; color: #38A169;">${hub.availableBikes} Bikes Ready</span>
              </div>
            </div>
          `,
          iconSize: [0, 0],
        });

        const marker = L.marker([hub.lat, hub.lng], { icon });
        marker.on('click', () => {
          setSelectedAsset({ ...hub, type: 'HUB' });
          map.flyTo([hub.lat, hub.lng], 14, { duration: 0.8 });
        });
        layerGroup.addLayer(marker);
      });
    }

    // 2. Swap Stations
    if (activeFilter === 'ALL' || activeFilter === 'SWAPS') {
      SWAP_STATIONS.forEach((station) => {
        const isSelected = selectedAsset?.id === station.id;
        const icon = L.divIcon({
          className: 'custom-swap-pin',
          html: `
            <div style="
              display: inline-flex;
              align-items: center;
              background: #FFFFFF;
              border-radius: 9999px;
              padding: 4px 10px 4px 4px;
              box-shadow: 0 8px 20px rgba(2, 132, 199, 0.2);
              border: ${isSelected ? '2px solid #0284C7' : '1px solid #EDF2F1'};
              cursor: pointer;
              white-space: nowrap;
              font-family: 'Poppins', sans-serif;
              transform: translate(-50%, -50%);
              transition: all 0.2s ease;
            ">
              <div style="
                width: 26px;
                height: 26px;
                border-radius: 13px;
                background: #0284C7;
                color: #FFFFFF;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 800;
                margin-right: 6px;
                box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4);
              ">⚡</div>
              <div style="display: flex; flex-direction: column; line-height: 1.1;">
                <span style="font-size: 11px; font-weight: 800; color: #172B3A;">${station.name.split(' ')[0]}</span>
                <span style="font-size: 9.5px; font-weight: 700; color: #0284C7;">${station.chargedBatteries}/${station.totalDocks} Swaps</span>
              </div>
            </div>
          `,
          iconSize: [0, 0],
        });

        const marker = L.marker([station.lat, station.lng], { icon });
        marker.on('click', () => {
          setSelectedAsset({ ...station, type: 'SWAP' });
          map.flyTo([station.lat, station.lng], 14, { duration: 0.8 });
        });
        layerGroup.addLayer(marker);
      });
    }

    // 3. Vehicles
    FLEET_VEHICLES.forEach((bike) => {
      if (activeFilter === 'MOVING' && bike.status !== 'MOVING') return;
      if (activeFilter === 'PARKED' && bike.status !== 'PARKED') return;
      if (activeFilter === 'LOW_BATTERY' && bike.battery >= 20) return;

      const isSelected = selectedAsset?.id === bike.id;
      const isLow = bike.battery < 20;
      const isMoving = bike.status === 'MOVING';

      const dotColor = isLow ? '#EF4444' : isMoving ? '#62CE90' : '#172B3A';
      const badgeBg = isLow ? '#FEE2E2' : '#EAF8F1';
      const badgeColor = isLow ? '#EF4444' : '#38A169';

      const icon = L.divIcon({
        className: 'custom-bike-pin',
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            background: #FFFFFF;
            border-radius: 9999px;
            padding: 4px 9px 4px 6px;
            box-shadow: 0 8px 22px rgba(23, 43, 58, 0.16);
            border: ${isSelected ? '2px solid #62CE90' : '1px solid #EDF2F1'};
            cursor: pointer;
            white-space: nowrap;
            font-family: 'Poppins', sans-serif;
            gap: 6px;
            transform: translate(-50%, -50%);
            transition: all 0.2s ease;
          ">
            <span style="
              width: 9px;
              height: 9px;
              border-radius: 999px;
              background: ${dotColor};
              ${isMoving ? 'box-shadow: 0 0 0 3px rgba(98, 206, 144, 0.35);' : ''}
            "></span>
            <span style="font-size: 11px; font-weight: 800; color: #172B3A; font-family: monospace;">${bike.plate}</span>
            <span style="
              font-size: 10px;
              font-weight: 800;
              background: ${badgeBg};
              color: ${badgeColor};
              padding: 1px 6px;
              border-radius: 9999px;
            ">${bike.battery}%</span>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([bike.lat, bike.lng], { icon });
      marker.on('click', () => {
        setSelectedAsset({ ...bike, type: 'BIKE' });
        map.flyTo([bike.lat, bike.lng], 15, { duration: 0.8 });
      });
      layerGroup.addLayer(marker);
    });
  }, [activeFilter, selectedAsset]);

  const handleCommand = (cmd: string) => {
    setCommandFeedback(`Executing "${cmd}" on ${selectedAsset?.plate || 'device'}...`);
    setTimeout(() => {
      setCommandFeedback(`✓ Command confirmed by onboard IoT ECU.`);
      setTimeout(() => setCommandFeedback(null), 2500);
    }, 900);
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([17.4435, 78.375], 13, { duration: 1 });
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#EDF2F1] shadow-neo overflow-hidden relative font-sans">
      {/* Top Bar with #62CE90 Neumorphism */}
      <div className="p-4 sm:p-5 border-b border-[#EDF2F1] bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-[#172B3A] tracking-tight flex items-center gap-2">
            <span>Fleet GPS & IoT Battery Map</span>
            <span className="text-[10px] font-extrabold text-[#38A169] bg-[#EAF8F1] px-2.5 py-0.5 rounded-full">
              Live Hyderabad
            </span>
          </h3>
          <p className="text-xs text-[#8A97A0] font-medium mt-0.5">
            Real-time visual map of all moving vehicles, charging stations, and main hubs.
          </p>
        </div>

        {/* Clean Neumorphic Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F8F7FD] rounded-2xl border border-[#EDF2F1] shadow-neo-sm">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 ${
              activeFilter === 'ALL'
                ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                : 'text-[#8A97A0] hover:text-[#172B3A]'
            }`}
          >
            All (54)
          </button>

          <button
            onClick={() => setActiveFilter('MOVING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 flex items-center gap-1.5 ${
              activeFilter === 'MOVING'
                ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                : 'text-[#8A97A0] hover:text-[#172B3A]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#62CE90]"></span>
            <span>Moving (14)</span>
          </button>

          <button
            onClick={() => setActiveFilter('PARKED')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 ${
              activeFilter === 'PARKED'
                ? 'bg-[#172B3A] text-white shadow-sm'
                : 'text-[#8A97A0] hover:text-[#172B3A]'
            }`}
          >
            Parked (36)
          </button>

          <button
            onClick={() => setActiveFilter('LOW_BATTERY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 flex items-center gap-1 ${
              activeFilter === 'LOW_BATTERY'
                ? 'bg-[#EF4444] text-white shadow-sm'
                : 'text-[#EF4444] hover:bg-[#FEE2E2]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low &lt;20%</span>
          </button>

          <button
            onClick={() => setActiveFilter('HUBS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 ${
              activeFilter === 'HUBS'
                ? 'bg-[#38A169] text-white shadow-sm'
                : 'text-[#8A97A0] hover:text-[#172B3A]'
            }`}
          >
            🏢 Hubs (3)
          </button>

          <button
            onClick={() => setActiveFilter('SWAPS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 ${
              activeFilter === 'SWAPS'
                ? 'bg-[#0284C7] text-white shadow-sm'
                : 'text-[#8A97A0] hover:text-[#172B3A]'
            }`}
          >
            ⚡ Swaps (4)
          </button>
        </div>
      </div>

      {/* Map Surface */}
      <div className="relative w-full h-[520px]">
        {/* Leaflet Mount Element */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Recenter Button on Top Right of Map */}
        <button
          onClick={handleRecenter}
          className="absolute top-4 right-4 z-10 p-3 bg-white/95 backdrop-blur-md rounded-2xl border border-[#EDF2F1] shadow-neo text-[#172B3A] hover:text-[#62CE90] transition"
          title="Recenter Map to Hyderabad Hub"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Floating Telemetry Stats on Bottom Left of Map */}
        <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-[#EDF2F1] shadow-neo text-xs font-extrabold text-[#172B3A]">
          <div className="flex items-center gap-1.5">
            <Battery className="w-4 h-4 text-[#62CE90]" />
            <span>Avg Fleet SoC: <strong className="text-[#38A169]">78%</strong></span>
          </div>
          <span className="text-[#CBD6D6]">•</span>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#0284C7]" />
            <span>2-Min Swaps Today: <strong>89</strong></span>
          </div>
          <span className="text-[#CBD6D6]">•</span>
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#62CE90]" />
            <span>GPS Lock: <strong>54/54 Online</strong></span>
          </div>
        </div>

        {/* Floating Neumorphic Inspector Card when Pin is Clicked */}
        {selectedAsset && (
          <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-white/95 backdrop-blur-md rounded-3xl border border-[#EDF2F1] shadow-neo p-5 z-20 animate-in slide-in-from-top-4 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EDF2F1]">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-neo-sm ${
                    selectedAsset.type === 'BIKE'
                      ? 'bg-gradient-to-br from-[#62CE90] to-[#48B87A]'
                      : selectedAsset.type === 'HUB'
                      ? 'bg-[#38A169]'
                      : 'bg-[#0284C7]'
                  }`}
                >
                  {selectedAsset.type === 'BIKE' ? '🛵' : selectedAsset.type === 'HUB' ? '🏢' : '⚡'}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#172B3A]">
                    {selectedAsset.plate || selectedAsset.name}
                  </h4>
                  <p className="text-xs font-medium text-[#8A97A0]">
                    {selectedAsset.model || selectedAsset.address}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedAsset(null)}
                className="w-7 h-7 rounded-full bg-[#F8F7FD] text-[#8A97A0] hover:text-[#172B3A] flex items-center justify-center text-xs font-bold shadow-neo-sm"
              >
                ✕
              </button>
            </div>

            {/* Vehicle Details */}
            {selectedAsset.type === 'BIKE' && (
              <div className="mt-3.5 space-y-3 text-xs font-semibold text-[#172B3A]">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-[#F8F7FD] rounded-2xl border border-[#EDF2F1] shadow-neo-sm">
                    <span className="text-[10px] text-[#8A97A0] uppercase font-bold">IoT State</span>
                    <p className="text-xs font-extrabold mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          selectedAsset.status === 'MOVING' ? 'bg-[#62CE90] animate-ping' : 'bg-[#172B3A]'
                        }`}
                      />
                      <span>{selectedAsset.status} {selectedAsset.speed > 0 ? `(${selectedAsset.speed} km/h)` : ''}</span>
                    </p>
                  </div>

                  <div className="p-3 bg-[#F8F7FD] rounded-2xl border border-[#EDF2F1] shadow-neo-sm">
                    <span className="text-[10px] text-[#8A97A0] uppercase font-bold">Battery SoC</span>
                    <p
                      className={`text-xs font-extrabold mt-0.5 ${
                        selectedAsset.battery < 20 ? 'text-[#EF4444]' : 'text-[#38A169]'
                      }`}
                    >
                      {selectedAsset.battery}% ({selectedAsset.rangeKm} km Range)
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F8F7FD] rounded-2xl border border-[#EDF2F1] space-y-1.5 text-[11px] shadow-neo-sm">
                  <div className="flex justify-between text-[#8A97A0]">
                    <span>Rider:</span>
                    <strong className="text-[#172B3A]">{selectedAsset.rider}</strong>
                  </div>
                  <div className="flex justify-between text-[#8A97A0]">
                    <span>Assigned Hub:</span>
                    <strong className="text-[#172B3A]">{selectedAsset.hub}</strong>
                  </div>
                  <div className="flex justify-between text-[#8A97A0]">
                    <span>Voltage / Temp:</span>
                    <strong className="text-[#172B3A]">{selectedAsset.voltage} • {selectedAsset.temp}</strong>
                  </div>
                </div>

                {/* Commands */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleCommand('Remote Immobilize')}
                    className="py-2.5 px-3 rounded-2xl bg-[#FEE2E2] text-[#EF4444] font-bold text-xs hover:bg-[#FCA5A5]/30 transition flex items-center justify-center gap-1.5 shadow-neo-sm"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Immobilize</span>
                  </button>

                  <button
                    onClick={() => handleCommand('Sound Alert Horn')}
                    className="py-2.5 px-3 rounded-2xl bg-[#EAF8F1] text-[#38A169] font-bold text-xs hover:bg-[#C8F0DC] transition flex items-center justify-center gap-1.5 shadow-neo-sm"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Sound Horn</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hub Details */}
            {selectedAsset.type === 'HUB' && (
              <div className="mt-3.5 space-y-3 text-xs font-semibold text-[#172B3A]">
                <div className="p-3 bg-[#EAF8F1] rounded-2xl border border-[#C8F0DC] text-center shadow-neo-sm">
                  <span className="text-[10px] text-[#38A169] uppercase font-bold">Available Fleet</span>
                  <h4 className="text-lg font-extrabold text-[#38A169]">
                    {selectedAsset.availableBikes} / {selectedAsset.totalBikes} Bikes Ready
                  </h4>
                </div>
                <div className="text-[11px] text-[#8A97A0] space-y-1">
                  <p><strong>Hours:</strong> {selectedAsset.openTime}</p>
                  <p><strong>Contact:</strong> {selectedAsset.contact}</p>
                </div>
              </div>
            )}

            {/* Swap Details */}
            {selectedAsset.type === 'SWAP' && (
              <div className="mt-3.5 space-y-3 text-xs font-semibold text-[#172B3A]">
                <div className="p-3 bg-[#E0F2FE] rounded-2xl border border-[#BAE6FD] text-center shadow-neo-sm">
                  <span className="text-[10px] text-[#0284C7] uppercase font-bold">Fast Swaps</span>
                  <h4 className="text-lg font-extrabold text-[#0284C7]">
                    {selectedAsset.chargedBatteries} / {selectedAsset.totalDocks} Batteries Ready
                  </h4>
                </div>
                <p className="text-[11px] text-[#8A97A0]">~90 Second Automatic Swap Cycle Active</p>
              </div>
            )}

            {commandFeedback && (
              <div className="mt-3 p-2.5 rounded-2xl bg-[#172B3A] text-white text-xs font-bold text-center animate-in fade-in">
                {commandFeedback}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
