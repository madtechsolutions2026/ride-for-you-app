import { useCallback, useEffect, useRef, useState } from 'react';
import { publicAuthClient } from '../api/client';

export function useOtpChallenge(phone: string, initialId?: string) {
  const [challengeId, setChallengeId] = useState(initialId);
  const [sending, setSending] = useState(!initialId);
  const [retryAfter, setRetryAfter] = useState(initialId ? 30 : 0);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const request = useCallback(async () => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSending(true);
    setError('');
    try {
      const { data } = await publicAuthClient.post('/auth/otp/request', { phone });
      if (!data?.challengeId) throw new Error('The server did not confirm the code request. Please retry.');
      setChallengeId(data.challengeId);
      setRetryAfter(data.resendAvailableIn ?? 30);
      return true;
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not request the code. Check your connection and tap Retry.');
      const wait = Number(e?.response?.data?.retryAfter);
      if (Number.isFinite(wait) && wait > 0) setRetryAfter(wait);
      return false;
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }, [phone]);

  useEffect(() => { if (!initialId) void request(); }, [initialId, request]);
  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setTimeout(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [retryAfter]);

  return { challengeId, sending, retryAfter, error, request };
}
