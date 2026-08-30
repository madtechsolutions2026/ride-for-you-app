import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { apiClient } from '../api/client';

export const KycReview: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/api/kyc/submissions');
      setSubmissions(res.data?.submissions || []);
      if (res.data?.submissions?.length > 0 && !selectedSub) {
        setSelectedSub(res.data.submissions[0]);
      }
    } catch (e) {
      console.error('Error fetching KYC submissions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleReview = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedSub) return;
    if (action === 'REJECT' && !rejectReason.trim()) {
      alert('Please provide a reason for rejecting the KYC verification.');
      return;
    }

    setProcessing(true);
    try {
      await apiClient.post(`/admin/api/kyc/review/${selectedSub.id}`, {
        action,
        reason: action === 'REJECT' ? rejectReason : undefined,
      });

      alert(`KYC Submission ${action === 'APPROVE' ? 'Approved ✓' : 'Rejected'}`);
      setSelectedSub(null);
      setRejectReason('');
      fetchSubmissions();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to submit review');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">KYC Verification Audit Vault</h3>
          <p className="text-xs text-slate-500">
            Review identity documents and approve high-speed rental privileges.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Submissions List (Left 4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col h-[700px]">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">
            Verification Queue ({submissions.length})
          </h4>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <p className="text-center py-10 text-xs text-slate-400">Loading queue...</p>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 px-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">All caught up!</p>
                <p className="text-[11px] text-slate-500 mt-1">No KYC submissions pending review.</p>
              </div>
            ) : (
              submissions.map((s) => {
                const isSelected = selectedSub?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSub(s)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-sm'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {s.fullName || 'Rider'}
                      </span>
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                          s.status === 'SUBMITTED'
                            ? 'bg-amber-100 text-amber-800'
                            : s.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">{s.phone}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{s.city || 'Hyderabad'}</span>
                      <span>{new Date(s.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Document Inspection & Decision Vault (Right 8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col h-[700px] overflow-y-auto">
          {selectedSub ? (
            <div className="space-y-6">
              {/* Applicant Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shadow-sm">
                    {selectedSub.fullName ? selectedSub.fullName.charAt(0).toUpperCase() : 'R'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedSub.fullName}</h3>
                    <p className="text-xs text-slate-500 font-mono">{selectedSub.phone} • {selectedSub.email || 'No email'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedSub.status === 'SUBMITTED'
                        ? 'bg-amber-100 text-amber-800'
                        : selectedSub.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Status: {selectedSub.status}
                  </span>
                </div>
              </div>

              {/* Data Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Aadhaar Number</span>
                  <p className="font-bold text-slate-900 font-mono mt-0.5">
                    {selectedSub.aadhaarNumber || 'Not provided'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Address</span>
                  <p className="font-bold text-slate-900 mt-0.5 truncate">
                    {selectedSub.address || selectedSub.city || 'Hyderabad'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Submitted Date</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {new Date(selectedSub.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Uploaded Documents Grid */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">
                  Attached Verification Documents
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Aadhaar Front */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center text-center">
                    <span className="text-[11px] font-bold text-slate-700 mb-2">Aadhaar Front</span>
                    {selectedSub.aadhaarFrontUrl ? (
                      <a
                        href={selectedSub.aadhaarFrontUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative w-full h-36 rounded-lg overflow-hidden border border-slate-300 block bg-slate-200"
                      >
                        <img
                          src={selectedSub.aadhaarFrontUrl}
                          alt="Aadhaar Front"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                          <Eye className="w-5 h-5" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-full h-36 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold">
                        Not uploaded
                      </div>
                    )}
                  </div>

                  {/* Aadhaar Back */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center text-center">
                    <span className="text-[11px] font-bold text-slate-700 mb-2">Aadhaar Back</span>
                    {selectedSub.aadhaarBackUrl ? (
                      <a
                        href={selectedSub.aadhaarBackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative w-full h-36 rounded-lg overflow-hidden border border-slate-300 block bg-slate-200"
                      >
                        <img
                          src={selectedSub.aadhaarBackUrl}
                          alt="Aadhaar Back"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                          <Eye className="w-5 h-5" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-full h-36 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold">
                        Not uploaded
                      </div>
                    )}
                  </div>

                  {/* Live Selfie */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center text-center">
                    <span className="text-[11px] font-bold text-slate-700 mb-2">Live Selfie</span>
                    {selectedSub.selfieUrl ? (
                      <a
                        href={selectedSub.selfieUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative w-full h-36 rounded-lg overflow-hidden border border-slate-300 block bg-slate-200"
                      >
                        <img
                          src={selectedSub.selfieUrl}
                          alt="Selfie"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                          <Eye className="w-5 h-5" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-full h-36 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold">
                        Not uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Vault Controls */}
              {selectedSub.status === 'SUBMITTED' && (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rejection Reason (Required only if rejecting)
                    </label>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Aadhaar image is blurry, please re-upload clear photo."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleReview('REJECT')}
                      disabled={processing}
                      className="flex-1 py-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 transition disabled:opacity-50"
                    >
                      Reject Submission
                    </button>
                    <button
                      onClick={() => handleReview('APPROVE')}
                      disabled={processing}
                      className="flex-1 py-3 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition shadow-md shadow-emerald-950/30 disabled:opacity-50"
                    >
                      Approve & Grant High-Speed Access
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              Select a verification submission from the queue to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

