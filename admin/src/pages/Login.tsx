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
    <div className="min-h-screen w-full bg-[#F8F7FD] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Soft Blurs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#62CE90]/15 blur-[90px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#62CE90]/10 blur-[90px] pointer-events-none" />

      {/* Floating Neumorphic Card */}
      <div className="w-full max-w-md bg-white border border-[#EDF2F1] rounded-3xl p-8 sm:p-10 shadow-neo relative z-10">
        {/* Brand Icon & Heading */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-18 h-18 rounded-3xl bg-white p-2 border border-[#EAF8F1] shadow-neo mb-4 flex items-center justify-center">
            <img src="/assets/icon.png" alt="Ride For You" className="w-14 h-14 rounded-2xl object-contain" />
          </div>

          <h1 className="text-2xl font-extrabold text-[#172B3A] tracking-tight">
            RIDE FOR <span className="text-[#62CE90]">YOU</span>
          </h1>
          <p className="text-xs font-extrabold text-[#8A97A0] tracking-wider uppercase mt-1">
            Enterprise Fleet Admin Portal
          </p>

          <div className="mt-3 flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#EAF8F1] border border-[#C8F0DC] text-[11px] text-[#38A169] font-bold shadow-neo-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-[#62CE90]" />
            <span>2FA OTP Secure Gateway</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5]/60 flex items-start gap-2.5 text-[#EF4444] text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-extrabold text-[#172B3A] mb-2">
                Administrator Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#8A97A0] absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  required
                  className="w-full bg-[#F8F7FD] border border-[#EDF2F1] text-[#172B3A] rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#62CE90] focus:ring-2 focus:ring-[#62CE90]/20 font-bold transition shadow-neo-inset placeholder:text-[#8A97A0]"
                />
              </div>
              <p className="text-[11px] text-[#8A97A0] mt-2">
                Super Admin Access: <span className="text-[#62CE90] font-extrabold">+917095682464</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white font-extrabold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition shadow-neo-btn disabled:opacity-50"
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
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-extrabold text-[#172B3A]">
                  Enter 6-Digit OTP Code
                </label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-[11px] text-[#62CE90] font-bold hover:underline"
                >
                  Change phone
                </button>
              </div>

              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#8A97A0] absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="e.g. 123456"
                  maxLength={6}
                  required
                  autoFocus
                  className="w-full bg-[#F8F7FD] border border-[#EDF2F1] text-[#172B3A] rounded-2xl pl-11 pr-4 py-3.5 text-base tracking-widest text-center focus:outline-none focus:border-[#62CE90] focus:ring-2 focus:ring-[#62CE90]/20 font-extrabold transition shadow-neo-inset"
                />
              </div>
              <p className="text-[11px] text-[#8A97A0] mt-2 text-center">
                OTP sent to <strong className="text-[#172B3A]">{phone}</strong> (dev master: <span className="text-[#62CE90] font-bold">123456</span>)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white font-extrabold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition shadow-neo-btn disabled:opacity-50"
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
              <p className="text-center text-[11px] text-[#8A97A0]">
                Resend code in {countdown}s
              </p>
            ) : (
              <button
                type="button"
                onClick={handleRequestOtp}
                className="w-full text-center text-xs text-[#62CE90] hover:underline font-bold"
              >
                Resend OTP
              </button>
            )}
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-[#EDF2F1] text-center">
          <p className="text-[11px] text-[#8A97A0] font-semibold">
            Ride For You Enterprise Fleet Management System • v2.5.0
          </p>
        </div>
      </div>
    </div>
  );
};
