import React, { useEffect, useState } from 'react';
import { UserCog, Plus, ShieldCheck, MapPin } from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Pill, toneFor, Btn, Modal, Field, input, Loader, EmptyState } from '../components/ui';

const ROLE_BLURB: Record<string, string> = {
  ADMIN: 'Full access to every screen and setting.',
  EXECUTIVE: 'Hub floor: handover, return, KYC, damage, recovery.',
  SUPPORT: 'Riders, payments and recovery follow-ups.',
};

const ALL_SCREENS = [
  'overview', 'riders', 'bookings', 'fleet', 'kyc', 'infrastructure',
  'finance', 'service', 'recovery', 'employees', 'reports', 'settings',
];

export const Employees: React.FC = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [roleScreens, setRoleScreens] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; row: any }>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, infra] = await Promise.all([
        apiClient.get('/admin/api/staff'),
        apiClient.get('/admin/api/infrastructure'),
      ]);
      setStaff(s.data.staff || []);
      setRoleScreens(s.data.roleScreens || {});
      setHubs(infra.data.hubs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const role = String(f.get('role'));
    const body: any = {
      fullName: f.get('fullName'),
      email: f.get('email') || undefined,
      role,
      assignedHubId: f.get('assignedHubId') || undefined,
      permissions: ALL_SCREENS.filter((s) => f.get(`perm_${s}`) === 'on'),
    };
    setBusy(true);
    try {
      if (modal?.mode === 'add') {
        body.phone = f.get('phone');
        await apiClient.post('/admin/api/staff', body);
      } else if (modal?.mode === 'edit') {
        await apiClient.put(`/admin/api/staff/${modal.row.id}`, body);
      }
      setModal(null);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (row: any) => {
    if (!confirm(`Revoke staff access for ${row.fullName}? Their account reverts to a normal rider.`))
      return;
    try {
      await apiClient.delete(`/admin/api/staff/${row.id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Revoke failed');
    }
  };

  const toggleStatus = async (row: any) => {
    try {
      await apiClient.put(`/admin/api/staff/${row.id}`, {
        accountStatus: row.accountStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED',
      });
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Update failed');
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-[#475569]">
          <UserCog className="w-4 h-4 text-[#62CE90]" />
          {staff.length} staff member{staff.length !== 1 ? 's' : ''} · they sign in with phone + OTP
        </div>
        <Btn variant="primary" onClick={() => setModal({ mode: 'add' })}>
          <Plus className="w-3.5 h-3.5" /> Add Employee
        </Btn>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Object.entries(ROLE_BLURB).map(([role, blurb]) => (
          <Card key={role} className="p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#62CE90]" />
              <span className="text-sm font-extrabold text-[#172B3A]">{role}</span>
              <Pill tone="slate">{staff.filter((s) => s.role === role).length}</Pill>
            </div>
            <p className="text-xs text-[#8A97A0] mt-1.5">{blurb}</p>
            <p className="text-[10px] text-[#94A3B8] mt-2">
              Screens: {(roleScreens[role] || []).join(', ')}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        {staff.length === 0 ? (
          <EmptyState icon="👥" title="No employees yet" hint="Add your first hub executive or support manager." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase tracking-wide border-b border-[#EDF2F1]">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Hub</th>
                <th className="px-5 py-3">Extra screens</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((row) => (
                <tr key={row.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-extrabold text-[#172B3A]">{row.fullName}</div>
                    <div className="text-xs text-[#8A97A0]">{row.phone}</div>
                  </td>
                  <td className="px-5 py-3">
                    <Pill tone={row.role === 'ADMIN' ? 'green' : 'blue'}>{row.role}</Pill>
                  </td>
                  <td className="px-5 py-3 text-xs text-[#475569]">
                    {row.assignedHub ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {row.assignedHub.name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#8A97A0]">
                    {row.permissions?.length ? row.permissions.join(', ') : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <Pill tone={toneFor(row.accountStatus)}>{row.accountStatus}</Pill>
                  </td>
                  <td className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap">
                    <Btn onClick={() => setModal({ mode: 'edit', row })}>Edit</Btn>
                    <Btn onClick={() => toggleStatus(row)}>
                      {row.accountStatus === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                    </Btn>
                    {row.role !== 'ADMIN' && (
                      <Btn variant="danger" onClick={() => revoke(row)}>
                        Revoke
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add Employee' : `Edit ${modal.mode === 'edit' ? modal.row.fullName : ''}`}
          onClose={() => setModal(null)}
          wide
        >
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full name">
                <input
                  name="fullName"
                  required
                  defaultValue={modal.mode === 'edit' ? modal.row.fullName : ''}
                  className={input}
                />
              </Field>
              {modal.mode === 'add' ? (
                <Field label="Phone (they log in with this)">
                  <input name="phone" required placeholder="+91…" className={input} />
                </Field>
              ) : (
                <Field label="Phone">
                  <input value={modal.row.phone} disabled className={input} />
                </Field>
              )}
              <Field label="Email (optional)">
                <input
                  name="email"
                  type="email"
                  defaultValue={modal.mode === 'edit' ? modal.row.email || '' : ''}
                  className={input}
                />
              </Field>
              <Field label="Role">
                <select
                  name="role"
                  defaultValue={modal.mode === 'edit' ? modal.row.role : 'EXECUTIVE'}
                  className={input}
                >
                  <option value="EXECUTIVE">EXECUTIVE — hub floor</option>
                  <option value="SUPPORT">SUPPORT — payments & riders</option>
                  <option value="ADMIN">ADMIN — everything</option>
                </select>
              </Field>
              <Field label="Assigned hub (executives)">
                <select
                  name="assignedHubId"
                  defaultValue={modal.mode === 'edit' ? modal.row.assignedHubId || '' : ''}
                  className={input}
                >
                  <option value="">— none —</option>
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div>
              <span className="text-[11px] font-extrabold text-[#475569] uppercase tracking-wide">
                Extra screen access (on top of the role default)
              </span>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {ALL_SCREENS.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
                    <input
                      type="checkbox"
                      name={`perm_${s}`}
                      defaultChecked={modal.mode === 'edit' && modal.row.permissions?.includes(s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn type="button" onClick={() => setModal(null)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? 'Saving…' : modal.mode === 'add' ? 'Create employee' : 'Save changes'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
