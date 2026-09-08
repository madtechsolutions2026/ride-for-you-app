import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { apiClient } from '../api/client';
import {
  Card, SectionHeader, Btn, Modal, Field, input, Table, TH, TD, TR,
  Pill, EmptyState, Loader,
} from '../components/ui';

export const Infrastructure: React.FC<{ tab?: 'hubs' | 'stations' }> = ({ tab = 'hubs' }) => {
  const [data, setData] = useState<{ hubs: any[]; swapStations: any[] }>({ hubs: [], swapStations: [] });
  const [loading, setLoading] = useState(true);
  const [hubModalOpen, setHubModalOpen] = useState(false);
  const [stationModalOpen, setStationModalOpen] = useState(false);

  const [hubName, setHubName] = useState('');
  const [hubAddress, setHubAddress] = useState('');
  const [hubLat, setHubLat] = useState(17.45);
  const [hubLng, setHubLng] = useState(78.36);
  const [hubCity, setHubCity] = useState('Hyderabad');
  const [hubPhone, setHubPhone] = useState('+91 40 1234 5678');
  const [hubOpen, setHubOpen] = useState('09:00');
  const [hubClose, setHubClose] = useState('21:00');

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
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add swap station');
    }
  };

  if (loading) return <Loader />;

  const totalBikes = data.hubs.reduce((sum, h) => sum + (h._count?.bikes || 0), 0);

  return (
    <>
      {tab === 'hubs' && (
        <Card className="p-5">
          <SectionHeader
            title="EV Main Hubs"
            hint={`${data.hubs.length} hubs · ${totalBikes} bikes stationed · pick-up, drop-off, maintenance and onboarding`}
            actions={
              <Btn variant="primary" onClick={() => setHubModalOpen(true)}>
                <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add Hub
              </Btn>
            }
          />

          {data.hubs.length === 0 ? (
            <EmptyState title="No hubs yet" hint="Add your first pick-up and drop-off centre." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TH>Hub</TH>
                  <TH>City</TH>
                  <TH>Address</TH>
                  <TH align="right">Bikes</TH>
                  <TH>Hours</TH>
                  <TH>Contact</TH>
                </tr>
              </thead>
              <tbody>
                {data.hubs.map((h) => (
                  <TR key={h.id}>
                    <TD className="font-medium text-ink whitespace-nowrap">{h.name}</TD>
                    <TD className="text-ink-muted whitespace-nowrap">{h.city}</TD>
                    <TD className="text-ink-soft max-w-[26rem]">{h.address}</TD>
                    <TD align="right" className="u-num text-ink">{h._count?.bikes || 0}</TD>
                    <TD className="u-num text-ink-muted whitespace-nowrap">
                      {h.openTime}–{h.closeTime}
                    </TD>
                    <TD className="u-num text-ink-soft whitespace-nowrap">{h.contactPhone}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'stations' && (
        <Card className="p-5">
          <SectionHeader
            title="Battery Swap Stations"
            hint={`${data.swapStations.length} stations · automated 2-minute battery replacement points`}
            actions={
              <Btn variant="primary" onClick={() => setStationModalOpen(true)}>
                <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add Station
              </Btn>
            }
          />

          {data.swapStations.length === 0 ? (
            <EmptyState title="No swap stations yet" hint="Deploy your first battery swap dock." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TH>Station</TH>
                  <TH>Address</TH>
                  <TH>Hours</TH>
                  <TH>Coordinates</TH>
                  <TH align="right">Status</TH>
                </tr>
              </thead>
              <tbody>
                {data.swapStations.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium text-ink whitespace-nowrap">{s.name}</TD>
                    <TD className="text-ink-soft max-w-[26rem]">{s.address}</TD>
                    <TD className="u-num text-ink-muted whitespace-nowrap">
                      {s.openTime}–{s.closeTime}
                    </TD>
                    <TD className="u-num text-ink-soft whitespace-nowrap">
                      {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </TD>
                    <TD align="right">
                      <Pill tone="green">Online</Pill>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {hubModalOpen && (
        <Modal title="Create EV Hub" onClose={() => setHubModalOpen(false)}>
          <form onSubmit={handleCreateHub} className="space-y-3.5">
            <Field label="Hub name">
              <input
                className={input}
                value={hubName}
                onChange={(e) => setHubName(e.target.value)}
                placeholder="Madhapur Tech Hub"
                required
              />
            </Field>
            <Field label="Full street address">
              <input
                className={input}
                value={hubAddress}
                onChange={(e) => setHubAddress(e.target.value)}
                placeholder="Near Metro Station, Madhapur, Hyderabad"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <input className={input} value={hubCity} onChange={(e) => setHubCity(e.target.value)} />
              </Field>
              <Field label="Contact phone">
                <input className={input} value={hubPhone} onChange={(e) => setHubPhone(e.target.value)} />
              </Field>
              <Field label="Opens">
                <input className={input} type="time" value={hubOpen} onChange={(e) => setHubOpen(e.target.value)} />
              </Field>
              <Field label="Closes">
                <input className={input} type="time" value={hubClose} onChange={(e) => setHubClose(e.target.value)} />
              </Field>
              <Field label="Latitude">
                <input
                  className={input} type="number" step="0.0001" value={hubLat}
                  onChange={(e) => setHubLat(Number(e.target.value))}
                />
              </Field>
              <Field label="Longitude">
                <input
                  className={input} type="number" step="0.0001" value={hubLng}
                  onChange={(e) => setHubLng(Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-rule">
              <Btn type="button" onClick={() => setHubModalOpen(false)}>Cancel</Btn>
              <Btn type="submit" variant="primary">Create hub</Btn>
            </div>
          </form>
        </Modal>
      )}

      {stationModalOpen && (
        <Modal title="Create Swap Station" onClose={() => setStationModalOpen(false)}>
          <form onSubmit={handleCreateStation} className="space-y-3.5">
            <Field label="Station name">
              <input
                className={input}
                value={stName}
                onChange={(e) => setStName(e.target.value)}
                placeholder="Mindspace Swap Dock"
                required
              />
            </Field>
            <Field label="Address / landmark">
              <input
                className={input}
                value={stAddress}
                onChange={(e) => setStAddress(e.target.value)}
                placeholder="Mindspace Circle, Hitech City"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                <input
                  className={input} type="number" step="0.0001" value={stLat}
                  onChange={(e) => setStLat(Number(e.target.value))}
                />
              </Field>
              <Field label="Longitude">
                <input
                  className={input} type="number" step="0.0001" value={stLng}
                  onChange={(e) => setStLng(Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-rule">
              <Btn type="button" onClick={() => setStationModalOpen(false)}>Cancel</Btn>
              <Btn type="submit" variant="primary">Create station</Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};
