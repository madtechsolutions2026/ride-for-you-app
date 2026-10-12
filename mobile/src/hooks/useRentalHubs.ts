import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';

export type RentalHub = {
  id: string; name: string; address: string; lat: number; lng: number;
  availableByCategory: { SWAP: number; HOME: number }; totalAvailable: number;
  distanceMeters?: number; openTime?: string; closeTime?: string;
};
export function distanceLabel(meters?: number): string {
  return typeof meters === 'number' && Number.isFinite(meters) ? `${(meters / 1000).toFixed(1)} km away` : 'Distance unavailable';
}
export function useRentalHubs(visible: boolean) {
  const [hubs, setHubs] = useState<RentalHub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true); setError(null); setHubs([]);
    try {
      const res = await apiClient.get('/rental/hubs');
      if (!Array.isArray(res.data?.hubs)) throw new Error('Invalid hub response');
      if (current === sequence.current) setHubs(res.data.hubs);
    } catch {
      if (current === sequence.current) { setHubs([]); setError('Could not load hubs. Please try again.'); }
    } finally { if (current === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => { if (visible) void refresh(); return () => { sequence.current++; }; }, [visible, refresh]);
  return { hubs, loading, error, refresh };
}
