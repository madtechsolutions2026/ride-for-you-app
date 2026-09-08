import React, { useState } from 'react';
import { ArrowRight, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Btn, Field, input } from '../components/ui';

const IS_DEV = import.meta.env.DEV;

export const Login: React.FC = () => {
  const { requestOtp, loginWithOtp } = useAuth();

  const [phone, setPhone] = useState(IS_DEV ? '+917095682464' : '');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.length < 10) {
      setError('Enter a valid phone number, e.g. +91 7095682464');
      return;
    }

    setError(null);
    setLoading(true);
    const res = await requestOtp(phone.trim());
    setLoading(false);

    if (res.success) {
      setStep('otp');
      startCountdown();
    } else {
      setError(res.error || 'Failed to generate OTP challenge');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length < 4) {
      setError('Enter the 6-digit code sent to your phone');
      return;
    }

    setError(null);
    setLoading(true);
    const res = await loginWithOtp(phone.trim(), otp.trim());
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'OTP verification failed');
    }
  };

  return (
    <div className="min-h-screen w-full bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2.5 mb-7">
          <img src="/assets/icon.png" alt="" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="u-title text-[19px] text-ink leading-none">Ride For You</h1>
            <span className="u-label text-[9.5px]">Operations</span>
          </div>
        </div>

        <div className="bg-surface border border-rule rounded-md p-6">
          <h2 className="u-title text-[16px] text-ink">Sign in</h2>
          <p className="text-[12.5px] text-ink-soft mt-0.5 mb-5">
            {step === 'phone'
              ? 'Staff access is verified by one-time code.'
              : `Code sent to ${phone}.`}
          </p>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-sm bg-signal-redSoft border border-signal-redLine flex items-start gap-2 text-signal-red text-[12px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.75} />
              <span>{error}</span>
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <Field label="Phone number">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  required
                  className={`${input} u-num`}
                />
              </Field>

              <Btn type="submit" variant="primary" disabled={loading} className="w-full justify-center py-2">
                {loading ? 'Sending code…' : <>Send code <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} /></>}
              </Btn>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="u-label">One-time code</span>
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    className="text-[11.5px] text-accent hover:underline"
                  >
                    Change number
                  </button>
                </div>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                  className={`${input} u-num text-center text-[18px] tracking-[0.4em] py-2.5`}
                />
              </div>

              <Btn type="submit" variant="primary" disabled={loading} className="w-full justify-center py-2">
                {loading ? 'Verifying…' : <><Lock className="w-3.5 h-3.5" strokeWidth={2} /> Verify and continue</>}
              </Btn>

              {countdown > 0 ? (
                <p className="text-center text-[11.5px] text-ink-soft">Resend in {countdown}s</p>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  className="w-full text-center text-[11.5px] text-accent hover:underline"
                >
                  Resend code
                </button>
              )}
            </form>
          )}
        </div>

        {IS_DEV && (
          <p className="text-[11px] text-ink-soft mt-3">
            Dev only — master OTP <span className="u-num text-ink-muted">123456</span>
          </p>
        )}
      </div>
    </div>
  );
};
