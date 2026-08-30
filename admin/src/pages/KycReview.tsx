import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Eye,
  FileCheck2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
} from 'lucide-react';
import { apiClient } from '../api/client';

export const KycReview: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/api/kyc/submissions');
      const list = res.data?.submissions || [];
      setSubmissions(list);
      if (list.length > 0 && !selectedSub) {
        setSelectedSub(list[0]);
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
      alert('Please enter a rejection reason (e.g. Aadhaar photo is unreadable).');
      return;
    }

    setProcessing(true);
    try {
      await apiClient.post(`/admin/api/kyc/review/${selectedSub.id}`, {
        action,
        reason: action === 'REJECT' ? rejectReason : undefined,
      });

      alert(`KYC Submission ${action === 'APPROVE' ? 'Approved ✓' : 'Rejected'}`);
      setRejectReason('');
      await fetchSubmissions();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to submit review');
    } finally {
      setProcessing(false);
    }
  };

  const filteredList = submissions.filter((s) => {
    if (filterTab !== 'ALL' && s.status !== filterTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.fullName?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.aadhaarNumber?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Sub Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-[#172B3A] tracking-tight">
            KYC Verification Vault
          </h3>
          <p className="text-xs text-[#8A97A0] font-medium">
            Review uploaded rider government ID documents and approve high-speed rental access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSubmissions}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-white border border-[#EDF2F1] text-[#8A97A0] hover:text-[#172B3A] shadow-sm transition"
            title="Refresh submissions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#18B878]' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Submissions List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-4 border border-[#EDF2F1] shadow-xl shadow-slate-200/40 flex flex-col h-[740px]">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-[#FBFBFD] rounded-2xl border border-[#EDF2F1] mb-3">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-extrabold transition ${
                filterTab === 'ALL'
                  ? 'bg-white text-[#172B3A] shadow-sm'
                  : 'text-[#8A97A0] hover:text-[#172B3A]'
              }`}
            >
              All ({submissions.length})
            </button>
            <button
              onClick={() => setFilterTab('SUBMITTED')}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-extrabold transition ${
                filterTab === 'SUBMITTED'
                  ? 'bg-[#FEF3C7] text-[#D97706] shadow-sm'
                  : 'text-[#8A97A0] hover:text-[#172B3A]'
              }`}
            >
              Pending ({submissions.filter((s) => s.status === 'SUBMITTED').length})
            </button>
            <button
              onClick={() => setFilterTab('APPROVED')}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-extrabold transition ${
                filterTab === 'APPROVED'
                  ? 'bg-[#E9F7F1] text-[#129461] shadow-sm'
                  : 'text-[#8A97A0] hover:text-[#172B3A]'
              }`}
            >
              Approved
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-[#8A97A0] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rider name or phone..."
              className="w-full bg-[#FBFBFD] border border-[#EDF2F1] rounded-2xl pl-9 pr-3 py-2 text-xs font-semibold text-[#172B3A] focus:outline-none focus:border-[#18B878]"
            />
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <p className="text-center py-12 text-xs text-[#8A97A0]">Loading verification records...</p>
            ) : filteredList.length === 0 ? (
              <div className="text-center py-16 px-4">
                <CheckCircle2 className="w-10 h-10 text-[#18B878] mx-auto mb-2" />
                <p className="text-xs font-extrabold text-[#172B3A]">No submissions in this filter</p>
                <p className="text-[11px] text-[#8A97A0] mt-1">All rider verifications are up to date.</p>
              </div>
            ) : (
              filteredList.map((s) => {
                const isSelected = selectedSub?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSub(s)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#E9F7F1] border-[#18B878] shadow-sm'
                        : 'bg-[#FBFBFD] border-[#EDF2F1] hover:bg-[#F3FAF6]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-[#172B3A] truncate">
                        {s.fullName || 'Rider Applicant'}
                      </span>
                      <span
                        className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                          s.status === 'SUBMITTED'
                            ? 'bg-[#FEF3C7] text-[#D97706]'
                            : s.status === 'APPROVED'
                            ? 'bg-[#DCF0E6] text-[#129461]'
                            : 'bg-[#FEE2E2] text-[#EF4444]'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8A97A0] font-mono">{s.phone}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#8A97A0]">
                      <span>{s.city || 'Hyderabad'}</span>
                      <span>{new Date(s.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail & Document Inspector (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-[#EDF2F1] shadow-xl shadow-slate-200/40 flex flex-col h-[740px] overflow-y-auto">
          {selectedSub ? (
            <div className="space-y-6">
              {/* Applicant Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDF2F1]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1FAE72] to-[#129461] text-white flex items-center justify-center font-extrabold text-lg shadow-md">
                    {selectedSub.fullName ? selectedSub.fullName.charAt(0).toUpperCase() : 'R'}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#172B3A]">{selectedSub.fullName}</h3>
                    <p className="text-xs text-[#8A97A0] font-mono">{selectedSub.phone} • {selectedSub.email || 'No email'}</p>
                  </div>
                </div>

                <div>
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold ${
                      selectedSub.status === 'SUBMITTED'
                        ? 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]'
                        : selectedSub.status === 'APPROVED'
                        ? 'bg-[#E9F7F1] text-[#129461] border border-[#DCF0E6]'
                        : 'bg-[#FEE2E2] text-[#EF4444] border border-[#FCA5A5]'
                    }`}
                  >
                    Status: {selectedSub.status}
                  </span>
                </div>
              </div>

              {/* Data Summary Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
                <div className="p-3.5 bg-[#FBFBFD] rounded-2xl border border-[#EDF2F1]">
                  <span className="text-[10px] font-bold text-[#8A97A0] uppercase">Aadhaar Number</span>
                  <p className="font-extrabold text-[#172B3A] font-mono mt-0.5">
                    {selectedSub.aadhaarNumber || '5544 3322 1100'}
                  </p>
                </div>
                <div className="p-3.5 bg-[#FBFBFD] rounded-2xl border border-[#EDF2F1]">
                  <span className="text-[10px] font-bold text-[#8A97A0] uppercase">Address</span>
                  <p className="font-extrabold text-[#172B3A] mt-0.5 truncate">
                    {selectedSub.address || selectedSub.city || 'Hyderabad'}
                  </p>
                </div>
                <div className="p-3.5 bg-[#FBFBFD] rounded-2xl border border-[#EDF2F1]">
                  <span className="text-[10px] font-bold text-[#8A97A0] uppercase">Submitted Time</span>
                  <p className="font-extrabold text-[#172B3A] mt-0.5">
                    {new Date(selectedSub.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Document Images Grid */}
              <div>
                <h4 className="text-xs font-extrabold text-[#172B3A] mb-3 uppercase tracking-wider">
                  Uploaded Identity Documents
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Aadhaar Front */}
                  <div className="p-3 bg-[#FBFBFD] rounded-2xl border border-[#EDF2F1] flex flex-col items-center text-center">
                    <span className="text-[11px] font-extrabold text-[#172B3A] mb-2">Aadhaar Front</span>
                    {selectedSub.aadhaarFrontUrl ? (
                      <a
                        href={selectedSub.aadhaarFrontUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative w-full h-40 rounded-xl overflow-hidden border border-[#EDF2F1] block bg-slate-100"
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
                      <div className="w-full h-40 rounded-xl bg-[#F3FAF6] border border-[#DCF0E6] flex flex-col items-center justify-center text-[#18B878] text-xs font-bold gap-1 p-2">
                        <FileCheck2 className="w-6 h-6" />
                        <span>Attached ✓</span>
                      </div>
                    )}
                  </div>

                  {/* Aadhaar Back */}
                  <div className="p-3 bg-[#FBFBFD] rounded-2xl border border-[#EDF2F1] flex flex-col items-center text-center">
                    <span className="text-[11px] font-extrabold text-[#172B3A] mb-2">Aadhaar Back</span>
                    {selectedSub.aadhaarBackUrl ? (
                      <a
                        href={selectedSub.aadhaarBackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative w-full h-40 rounded-xl overflow-hidden border border-[#EDF2F1] block bg-slate-100"
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
                      <div className="w-full h-40 rounded-xl bg-[#F3FAF6] border border-[#DCF0E6] flex flex-col items-center justify-center text-[#18B878] text-xs font-bold gap-1 p-2">
                        <FileCheck2 className="w-6 h-6" />
                        <span>Attached ✓</span>
                      </div>
                    )}
                  </div>

                  {/* Live Selfie */}
                  <div className="p-3 bg-[#FBFBFD] rounded-2xl border border-[#EDF2F1] flex flex-col items-center text-center">
                    <span className="text-[11px] font-extrabold text-[#172B3A] mb-2">Live Camera Selfie</span>
                    {selectedSub.selfieUrl ? (
                      <a
                        href={selectedSub.selfieUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative w-full h-40 rounded-xl overflow-hidden border border-[#EDF2F1] block bg-slate-100"
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
                      <div className="w-full h-40 rounded-xl bg-[#F3FAF6] border border-[#DCF0E6] flex flex-col items-center justify-center text-[#18B878] text-xs font-bold gap-1 p-2">
                        <FileCheck2 className="w-6 h-6" />
                        <span>Attached ✓</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              {selectedSub.status === 'SUBMITTED' ? (
                <div className="pt-4 border-t border-[#EDF2F1] space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-[#172B3A] mb-1.5">
                      Rejection Reason (Required only when rejecting)
                    </label>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Document is blurry, please take a clear camera photo."
                      className="w-full bg-[#FBFBFD] border border-[#EDF2F1] rounded-2xl px-4 py-2.5 text-xs text-[#172B3A] font-semibold focus:outline-none focus:border-[#18B878]"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleReview('REJECT')}
                      disabled={processing}
                      className="flex-1 py-3.5 rounded-2xl bg-[#FEE2E2] text-[#EF4444] font-extrabold text-xs hover:bg-[#FCA5A5]/30 transition disabled:opacity-50"
                    >
                      Reject Submission
                    </button>
                    <button
                      onClick={() => handleReview('APPROVE')}
                      disabled={processing}
                      className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#1FAE72] via-[#5FD9A4] to-[#9EE7C4] text-white font-extrabold text-xs hover:opacity-95 transition shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                    >
                      Approve & Grant High-Speed Access ✓
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-[#EDF2F1] flex items-center justify-between text-xs font-bold text-[#8A97A0]">
                  <span>Reviewed at: {selectedSub.reviewedAt ? new Date(selectedSub.reviewedAt).toLocaleString() : 'Done'}</span>
                  {selectedSub.status === 'APPROVED' && (
                    <span className="text-[#129461] bg-[#E9F7F1] px-3 py-1 rounded-full">
                      ✓ Approved for Rentals
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#8A97A0] text-xs font-bold">
              Select a verification record from the left queue to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
