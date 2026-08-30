import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, Clock, CheckCircle2, MapPin } from 'lucide-react';
import { apiClient } from '../api/client';

export const Riders: React.FC = () => {
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    } catch (e) {
      alert('Failed to update rider status');
    } finally {
      setUpdatingId(null);
    }
  };

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
            <option value="NOT_SUBMITTED">Not Submitted</option>
          </select>

          <button
            onClick={fetchRiders}
            className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition"
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
                <th className="py-3.5 px-6">Rider Name & Phone</th>
                <th className="py-3.5 px-6">Location</th>
                <th className="py-3.5 px-6">KYC Status</th>
                <th className="py-3.5 px-6">Account Status</th>
                <th className="py-3.5 px-6">Registered On</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading riders directory...
                  </td>
                </tr>
              ) : riders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No riders found matching filters.
                  </td>
                </tr>
              ) : (
                riders.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                          {r.fullName ? r.fullName.charAt(0).toUpperCase() : 'R'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{r.fullName || 'Registered Rider'}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{r.phone}</p>
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
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {r.accountStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-6 text-slate-500 text-[11px]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-6 text-right">
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
                          ? 'Updating...'
                          : r.accountStatus === 'BLOCKED'
                          ? 'Unblock'
                          : 'Block'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

