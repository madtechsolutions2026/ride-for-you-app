import React, { useState } from 'react';
import { Bike, ShieldCheck, ArrowRight, Lock, Phone, KeyRound, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { requestOtp, loginWithOtp } = useAuth();

  const [phone, setPhone] = useState('+917095682464');
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
      setError('Please enter a valid phone number (e.g. +91 7095682464 or 7095682464)');
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
      setError('Please enter the 6-digit OTP sent to your phone');
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
    <div className="min-h-screen w-full bg-[#090D16] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Neon Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#00C9A7]/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0F172A]/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Brand Icon */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00C9A7] to-[#0B6623] flex items-center justify-center shadow-lg shadow-emerald-950/60 mb-4 ring-4 ring-emerald-500/20">
            <Bike className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">RIDE FOR YOU</h1>
          <p className="text-xs font-semibold text-emerald-400 tracking-widest uppercase mt-1">
            Enterprise Fleet Portal
          </p>
          <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>High-Security 2FA Authentication</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Administrator Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  required
                  className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Standard test admin: <code className="text-emerald-400">+917095682464</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#0B6623] to-[#00C9A7] text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
            >
              {loading ? (
                <span>Generating OTP challenge...</span>
              ) : (
                <>
                  <span>Request Login OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Enter 6-Digit OTP Code
                </label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  Change phone
                </button>
              </div>

              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="e.g. 123456"
                  maxLength={6}
                  required
                  autoFocus
                  className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl pl-11 pr-4 py-3 text-base tracking-widest text-center focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-bold transition"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                OTP sent to <span className="text-white font-semibold">{phone}</span> (dev code: <span className="text-emerald-400 font-bold">123456</span>)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#0B6623] to-[#00C9A7] text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating role...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Verify & Enter Dashboard</span>
                </>
              )}
            </button>

            {countdown > 0 ? (
              <p className="text-center text-[11px] text-slate-500">
                Resend code in {countdown}s
              </p>
            ) : (
              <button
                type="button"
                onClick={handleRequestOtp}
                className="w-full text-center text-xs text-emerald-400 hover:underline font-semibold"
              >
                Resend OTP
              </button>
            )}
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Ride For You Enterprise Fleet Management System • v2.4.0
          </p>
        </div>
      </div>
    </div>
  );
};
