import React, { useState, useEffect } from 'react';
import {
  Search,
  ShieldAlert,
  Clock,
  CheckCircle2,
  MapPin,
  X,
  Bike,
  ExternalLink,
  ChevronRight,
  Receipt,
  Shield,
  AlertTriangle,
  Phone,
  Mail,
} from 'lucide-react';
import { apiClient } from '../api/client';

export const Riders: React.FC = () => {
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Rider Details Modal State
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [riderDetail, setRiderDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookings' | 'kyc' | 'payments'>('bookings');

  const fetchRiders = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (kycFilter) params.kycStatus = kycFilter;

      const res = await apiClient.get('/admin/api/users', { params });
      setRiders(res.data?.users || []);
    } catch (e) {
      console.error('Error fetching riders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiders();
  }, [kycFilter]);

  const handleOpenDetail = async (riderId: string) => {
    setSelectedRiderId(riderId);
    setDetailLoading(true);
    setActiveTab('bookings');
    try {
      const res = await apiClient.get(`/admin/api/users/${riderId}/detail`);
      setRiderDetail(res.data);
    } catch (e) {
      console.error('Error fetching rider detail:', e);
      alert('Could not load rider details. Please try again.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedRiderId(null);
    setRiderDetail(null);
  };

  const handleToggleStatus = async (user: any) => {
    const nextStatus = user.accountStatus === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    setUpdatingId(user.id);
    try {
      await apiClient.put(`/admin/api/users/${user.id}/status`, {
        accountStatus: nextStatus,
      });
      setRiders((prev) =>
        prev.map((r) => (r.id === user.id ? { ...r, accountStatus: nextStatus } : r))
      );
      if (riderDetail && riderDetail.user.id === user.id) {
        setRiderDetail((prev: any) => ({
          ...prev,
          user: { ...prev.user, accountStatus: nextStatus },
        }));
      }
    } catch (e) {
      alert('Failed to update rider status');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatCurrency = (amount: number) =>
    `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRiders()}
            placeholder="Search by name, phone, email, city..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All KYC Statuses</option>
            <option value="APPROVED">KYC Approved</option>
            <option value="SUBMITTED">Pending Review</option>
            <option value="REJECTED">Rejected</option>
            <option value="PENDING">Not Submitted</option>
          </select>

          <button
            onClick={fetchRiders}
            className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition shadow-sm"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Riders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Rider Profile</th>
                <th className="py-3.5 px-6">Location</th>
                <th className="py-3.5 px-6">Bookings</th>
                <th className="py-3.5 px-6">KYC Status</th>
                <th className="py-3.5 px-6">Account Status</th>
                <th className="py-3.5 px-6">Registered On</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading registered riders directory...
                  </td>
                </tr>
              ) : riders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No riders found matching filters.
                  </td>
                </tr>
              ) : (
                riders.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/80 transition cursor-pointer"
                    onClick={() => handleOpenDetail(r.id)}
                  >
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shadow-inner">
                          {r.fullName ? r.fullName.charAt(0).toUpperCase() : 'R'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{r.fullName || 'Registered Rider'}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{r.phone}</p>
                          {r.email && <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{r.email}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{r.city || 'Hyderabad'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-6">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <Bike className="w-3 h-3 text-emerald-600" />
                        <span>{r._count?.bookings || 0} Bookings</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-6">
                      {r.kycStatus === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approved</span>
                        </span>
                      ) : r.kycStatus === 'SUBMITTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          <span>Pending Review</span>
                        </span>
                      ) : r.kycStatus === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Rejected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          <span>Not Submitted</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                          r.accountStatus === 'BLOCKED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {r.accountStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-6 text-slate-500 text-[11px]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenDetail(r.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition inline-flex items-center gap-1"
                        >
                          <span>View Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(r)}
                          disabled={updatingId === r.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                            r.accountStatus === 'BLOCKED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {updatingId === r.id
                            ? '...'
                            : r.accountStatus === 'BLOCKED'
                            ? 'Unblock'
                            : 'Block'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- 360-DEGREE RIDER DETAILS MODAL ---------------- */}
      {selectedRiderId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center font-bold text-xl shadow-lg">
                  {riderDetail?.user?.fullName ? riderDetail.user.fullName.charAt(0).toUpperCase() : 'R'}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-white">
                      {riderDetail?.user?.fullName || 'Rider Profile'}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        riderDetail?.user?.accountStatus === 'BLOCKED'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {riderDetail?.user?.accountStatus || 'ACTIVE'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-300 font-medium">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      {riderDetail?.user?.phone}
                    </span>
                    {riderDetail?.user?.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-emerald-400" />
                        {riderDetail.user.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      {riderDetail?.user?.city || 'Hyderabad'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {riderDetail?.user && (
                  <button
                    onClick={() => handleToggleStatus(riderDetail.user)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                      riderDetail.user.accountStatus === 'BLOCKED'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent'
                        : 'bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border-rose-500/30'
                    }`}
                  >
                    {riderDetail.user.accountStatus === 'BLOCKED' ? 'Unblock Rider' : 'Block Rider'}
                  </button>
                )}
                <button
                  onClick={handleCloseDetail}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {detailLoading ? (
              <div className="p-16 text-center text-slate-400">
                <Clock className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
                <p className="font-semibold text-xs text-slate-600">Loading complete rider ledger and profile...</p>
              </div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
                {/* 5 Financial Summary Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lifetime Paid</p>
                    <p className="text-base font-extrabold text-emerald-700 mt-1">
                      {formatCurrency(riderDetail?.stats?.totalPaid)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Total settled</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bookings Done</p>
                    <p className="text-base font-extrabold text-slate-800 mt-1">
                      {riderDetail?.stats?.totalBookings || 0}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{riderDetail?.stats?.totalRentals || 0} Rentals</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deposit Held</p>
                    <p className="text-base font-extrabold text-indigo-700 mt-1">
                      {formatCurrency(riderDetail?.stats?.totalDepositHeld)}
                    </p>
                    <p className="text-[10px] text-indigo-500 mt-0.5">Refunded: {formatCurrency(riderDetail?.stats?.totalRefunded)}</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Damage Assessed</p>
                    <p className="text-base font-extrabold text-amber-700 mt-1">
                      {formatCurrency(riderDetail?.stats?.totalDamages)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Reported damage</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overdue Balance</p>
                    <p className={`text-base font-extrabold mt-1 ${riderDetail?.stats?.overdueInvoices > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {formatCurrency(riderDetail?.stats?.overdueInvoices)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Pending rent</p>
                  </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
                  <button
                    onClick={() => setActiveTab('bookings')}
                    className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
                      activeTab === 'bookings'
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Bike className="w-4 h-4" />
                    <span>Bookings & Rentals ({riderDetail?.bookings?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('kyc')}
                    className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
                      activeTab === 'kyc'
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    <span>KYC Verification & Docs</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('payments')}
                    className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
                      activeTab === 'payments'
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Payments Ledger ({riderDetail?.payments?.length || 0})</span>
                  </button>
                </div>

                {/* Tab Content 1: Bookings & Rentals History */}
                {activeTab === 'bookings' && (
                  <div className="space-y-4">
                    {(!riderDetail?.bookings || riderDetail.bookings.length === 0) ? (
                      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
                        <Bike className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-xs">No bookings created yet by this rider.</p>
                      </div>
                    ) : (
                      riderDetail.bookings.map((b: any) => (
                        <div
                          key={b.id}
                          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
                        >
                          {/* Booking Top Info */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                {b.reference}
                              </span>
                              <div>
                                <h4 className="font-bold text-xs text-slate-900">
                                  {b.model?.name || 'EV Bike'} ({b.model?.category || 'SWAP'})
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                  Pickup: <span className="font-semibold">{b.hub?.name || 'Hub'}</span> • {new Date(b.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  b.status === 'HANDED_OVER'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : b.status === 'CONFIRMED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : b.status === 'CANCELLED'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {b.status}
                              </span>
                            </div>
                          </div>

                          {/* Booking Financial Itemization Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60 text-xs">
                            <div>
                              <p className="text-[10px] text-slate-500 font-semibold uppercase">Plan & Rent</p>
                              <p className="font-bold text-slate-900 mt-0.5">
                                {formatCurrency(b.rentAmount)} <span className="text-[10px] text-slate-500">({b.plan?.duration || 'WEEK'})</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-semibold uppercase">Security Deposit</p>
                              <p className="font-bold text-indigo-700 mt-0.5">
                                {formatCurrency(b.depositAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-semibold uppercase">Platform Fee</p>
                              <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(b.platformFee)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-semibold uppercase">Total Booking Value</p>
                              <p className="font-extrabold text-emerald-800 mt-0.5">{formatCurrency(b.totalAmount)}</p>
                            </div>
                          </div>

                          {/* Handed Over Unit / Rental Specifics */}
                          {b.rental && (
                            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-200 text-indigo-800 flex items-center justify-center font-bold">
                                  🛵
                                </div>
                                <div>
                                  <p className="font-bold text-indigo-950">
                                    Assigned Unit: <span className="font-mono text-emerald-700">{b.rental.bike?.registrationNumber || 'Assigned'}</span>
                                  </p>
                                  <p className="text-[11px] text-indigo-700">
                                    Battery: {b.rental.bike?.batteryPercent ?? 100}% • Odometer: {b.rental.bike?.odometerKm ?? 0} km
                                  </p>
                                </div>
                              </div>

                              <div className="text-right text-[11px] text-indigo-800 font-medium">
                                <p>Handover: {new Date(b.rental.handoverAt).toLocaleDateString()}</p>
                                <p>Status: <span className="font-bold">{b.rental.status}</span></p>
                              </div>
                            </div>
                          )}

                          {/* Damage Reports for this booking */}
                          {b.rental?.damageReports && b.rental.damageReports.length > 0 && (
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1.5">
                              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Damage Reported on this Rental:</span>
                              </div>
                              {b.rental.damageReports.map((dmg: any) => (
                                <div key={dmg.id} className="flex items-center justify-between text-amber-800 pl-5">
                                  <span>{dmg.description} ({dmg.severity})</span>
                                  <span className="font-bold text-rose-700">{formatCurrency(dmg.estimatedCost)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Payments for this specific booking */}
                          {b.payments && b.payments.length > 0 && (
                            <div className="border-t border-slate-100 pt-2 text-xs">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Payments for this booking ({b.payments.length})
                              </p>
                              <div className="space-y-1.5">
                                {b.payments.map((p: any) => (
                                  <div
                                    key={p.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-[11px]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`w-2 h-2 rounded-full ${
                                          p.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`}
                                      />
                                      <span className="font-bold text-slate-800">{p.paymentType}</span>
                                      <span className="text-slate-400 font-mono text-[10px]">
                                        {p.gateway} • {new Date(p.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <span
                                      className={`font-bold ${
                                        p.paymentType === 'REFUND' ? 'text-indigo-600' : 'text-emerald-700'
                                      }`}
                                    >
                                      {p.paymentType === 'REFUND' ? '-' : '+'}
                                      {formatCurrency(p.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab Content 2: KYC Documents & Verification */}
                {activeTab === 'kyc' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">KYC Verification Record</h4>
                        <p className="text-xs text-slate-500">
                          Aadhaar Number: <span className="font-mono font-bold">{riderDetail?.kyc?.aadhaarNumber || 'Not provided'}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Address: <span className="font-medium">{riderDetail?.kyc?.address || riderDetail?.user?.city || 'Hyderabad'}</span>
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          riderDetail?.user?.kycStatus === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : riderDetail?.user?.kycStatus === 'SUBMITTED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {riderDetail?.user?.kycStatus || 'PENDING'}
                      </span>
                    </div>

                    {/* KYC Document Previews */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Aadhaar Front */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <p className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Aadhaar Front</span>
                          {riderDetail?.kyc?.aadhaarFrontUrl && (
                            <a
                              href={riderDetail.kyc.aadhaarFrontUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline flex items-center gap-1 text-[11px]"
                            >
                              Open Full <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </p>
                        {riderDetail?.kyc?.aadhaarFrontUrl ? (
                          <img
                            src={riderDetail.kyc.aadhaarFrontUrl}
                            alt="Aadhaar Front"
                            className="w-full h-36 object-cover rounded-lg border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="h-36 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                            No Aadhaar Front image
                          </div>
                        )}
                      </div>

                      {/* Aadhaar Back */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <p className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Aadhaar Back</span>
                          {riderDetail?.kyc?.aadhaarBackUrl && (
                            <a
                              href={riderDetail.kyc.aadhaarBackUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline flex items-center gap-1 text-[11px]"
                            >
                              Open Full <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </p>
                        {riderDetail?.kyc?.aadhaarBackUrl ? (
                          <img
                            src={riderDetail.kyc.aadhaarBackUrl}
                            alt="Aadhaar Back"
                            className="w-full h-36 object-cover rounded-lg border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="h-36 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                            No Aadhaar Back image
                          </div>
                        )}
                      </div>

                      {/* Live Selfie */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <p className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Live Selfie</span>
                          {riderDetail?.kyc?.selfieUrl && (
                            <a
                              href={riderDetail.kyc.selfieUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline flex items-center gap-1 text-[11px]"
                            >
                              Open Full <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </p>
                        {riderDetail?.kyc?.selfieUrl ? (
                          <img
                            src={riderDetail.kyc.selfieUrl}
                            alt="Selfie"
                            className="w-full h-36 object-cover rounded-lg border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="h-36 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                            No Selfie image
                          </div>
                        )}
                      </div>

                      {/* Address / Rental Proof */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <p className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Address / Rental Proof</span>
                          {riderDetail?.kyc?.addressProofUrl && (
                            <a
                              href={riderDetail.kyc.addressProofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline flex items-center gap-1 text-[11px]"
                            >
                              Open Full <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </p>
                        {riderDetail?.kyc?.addressProofUrl ? (
                          <img
                            src={riderDetail.kyc.addressProofUrl}
                            alt="Address Proof"
                            className="w-full h-36 object-cover rounded-lg border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="h-36 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                            No Address Proof image
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content 3: Payments Ledger */}
                {activeTab === 'payments' && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-3 px-4">Payment ID</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Gateway</th>
                            <th className="py-3 px-4">Date & Time</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(!riderDetail?.payments || riderDetail.payments.length === 0) ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                                No payments recorded yet.
                              </td>
                            </tr>
                          ) : (
                            riderDetail.payments.map((p: any) => (
                              <tr key={p.id} className="hover:bg-slate-50/80">
                                <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.id.slice(0, 12)}...</td>
                                <td className="py-3 px-4 font-bold text-slate-800">{p.paymentType}</td>
                                <td className="py-3 px-4 text-slate-500">{p.gateway}</td>
                                <td className="py-3 px-4 text-slate-500">{new Date(p.createdAt).toLocaleString()}</td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      p.status === 'SUCCESS'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-rose-50 text-rose-700'
                                    }`}
                                  >
                                    {p.status}
                                  </span>
                                </td>
                                <td
                                  className={`py-3 px-4 text-right font-bold ${
                                    p.paymentType === 'REFUND' ? 'text-indigo-600' : 'text-emerald-700'
                                  }`}
                                >
                                  {p.paymentType === 'REFUND' ? '-' : '+'}
                                  {formatCurrency(p.amount)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


