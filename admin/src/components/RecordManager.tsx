import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { errMsg } from '../api/errors';
import { usePageRefresh } from '../context/RefreshContext';
import { Btn, Card, Field, input, Modal, Table, TH, TD, TR } from './ui';

type FieldSpec = { name: string; label: string; type?: string; required?: boolean; options?: string[]; lookup?: string; createOnly?: boolean; editOnly?: boolean; min?: number; max?: number };
type Spec = { label: string; sections: string[]; fields: FieldSpec[]; create?: string; remove?: string; readOnly?: boolean };
type Row = Record<string, any>;
const removalLabels: Record<string, string> = { correctAttendance: 'Mark absent', suspend: 'Suspend', revoke: 'Revoke access', deactivateEmployee: 'Deactivate', cancelBooking: 'Cancel booking', returnRental: 'Record return', cancelRequest: 'Cancel request', rejectKyc: 'Reject submission', refundPayment: 'Record offline refund', waiveInvoice: 'Waive invoice', waiveDamage: 'Waive charge', cancelService: 'Cancel ticket', closeRecovery: 'Close job', closeSupport: 'Close ticket' };
const rowLabel = (row: Row) => row.name || row.fullName || row.reference || row.registrationNumber || row.ticketNumber || row.partName || row.phone || row.id;
const format = (value: any) => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);
const dateValue = (value: any) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

function Lookup({ field, value, onChange }: { field: FieldSpec; value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      apiClient.get(`/admin/api/records/${field.lookup}`, { params: { search: query } }).then(res => { if (active) { setRows(res.data.data); setError(''); } }).catch(e => { if (active) setError(errMsg(e, 'Could not load choices')); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [field.lookup, query]);
  return <div className="space-y-1">
    <input className={input} aria-label={`Search ${field.label}`} placeholder={`Search ${field.label.toLowerCase()}`} value={query} onChange={e => setQuery(e.target.value)} />
    <select className={input} required={field.required} value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">Select {field.label.toLowerCase()}</option>
      {value && !rows.some(row => row.id === value) && <option value={value}>{value}</option>}
      {rows.map(row => <option key={row.id} value={row.id}>{rowLabel(row)}{row.status ? ` (${row.status})` : ''}</option>)}
    </select>
    {error && <p role="alert" className="text-signal-red text-xs">{error}</p>}
  </div>;
}

export function RecordManager({ section, onChanged }: { section: string; onChanged?: () => Promise<unknown> | void }) {
  const [catalog, setCatalog] = useState<Record<string, Spec>>({});
  const [entity, setEntity] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit' | 'view' | 'remove'; row?: Row } | null>(null);
  const [values, setValues] = useState<Row>({});
  const [reason, setReason] = useState('');
  const sequence = useRef(0);
  const spec = catalog[entity];
  const choices = Object.entries(catalog).filter(([, item]) => section === 'overview' || section === 'reports' || item.sections.includes(section));
  useEffect(() => {
    let active = true;
    apiClient.get('/admin/api/records').then(res => {
      if (!active) return;
      const data = res.data.data;
      setCatalog(data);
      setEntity(Object.keys(data).find(key => section === 'overview' || section === 'reports' || data[key].sections.includes(section)) || '');
    }).catch(e => { if (active) setError(errMsg(e, 'Could not load record sections')); });
    return () => { active = false; sequence.current++; };
  }, [section]);
  useEffect(() => { const timer = setTimeout(() => { setPage(1); setQuery(search); }, 300); return () => clearTimeout(timer); }, [search]);
  const reload = useCallback(async () => {
    if (!entity) return;
    const current = ++sequence.current;
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/api/records/${entity}`, { params: { page, search: query } });
      if (current === sequence.current) { setRows(res.data.data); setTotal(res.data.total); setError(''); }
    } catch (e) { if (current === sequence.current) { setRows([]); setError(errMsg(e, 'Could not load records')); } }
    finally { if (current === sequence.current) setLoading(false); }
  }, [entity, page, query]);
  useEffect(() => { void reload(); return () => { sequence.current++; }; }, [reload]);
  usePageRefresh(reload);
  const open = (mode: 'create' | 'edit' | 'view' | 'remove', row?: Row) => {
    setError(''); setReason(''); setDialog({ mode, row });
    setValues(Object.fromEntries((spec?.fields || []).filter(field => mode === 'create' ? !field.editOnly : !field.createOnly).map(field => [field.name, row ? field.type === 'date' ? field.name === 'date' ? String(row[field.name] || '').slice(0, 10) : dateValue(row[field.name]) : row[field.name] ?? '' : field.type === 'boolean' ? false : ''])));
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dialog || !spec || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const base = `/admin/api/records/${entity}`;
      if (dialog.mode === 'remove') await apiClient.delete(`${base}/${dialog.row!.id}`, { data: { reason } });
      else {
        const body: Row = {};
        for (const field of spec.fields.filter(field => dialog.mode === 'create' ? !field.editOnly : !field.createOnly)) {
          const value = values[field.name];
          if (dialog.mode === 'create' && (value === '' || value === undefined)) continue;
          body[field.name] = field.type === 'number' && value !== '' ? Number(value) : field.type === 'date' && value ? new Date(value).toISOString() : value === '' ? null : value;
        }
        if (dialog.mode === 'create') await apiClient.post(base, body);
        else await apiClient.put(`${base}/${dialog.row!.id}`, body);
      }
      setDialog(null); setMessage(dialog.mode === 'remove' ? 'Removal recorded.' : 'Saved successfully.');
      if (dialog.mode === 'remove' && rows.length === 1 && page > 1) setPage(page - 1);
      if (onChanged) await onChanged();
      else await reload();
    } catch (e) { setError(errMsg(e, 'Could not save the record')); }
    finally { setBusy(false); }
  };
  const columns = ['id', ...new Set([...((spec?.fields || []).filter(field => !field.createOnly).map(field => field.name)), ...(spec?.readOnly ? ['reference', 'userId', 'riderId', 'bikeId', 'direction', 'reason', 'amount', 'createdAt'] : []), 'status'])].filter(name => rows.some(row => row[name] !== undefined)).slice(0, 6);
  return <Card className="p-5">
    <div className="flex items-end gap-3 flex-wrap mb-4">
      <Field label="Data section"><select className={input} value={entity} onChange={e => { setRows([]); setTotal(0); setPage(1); setSearch(''); setQuery(''); setEntity(e.target.value); setMessage(''); }}>{choices.map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></Field>
      <Field label="Search records"><input className={input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone, reference or ID" /></Field>
      {spec && !spec.readOnly && <Btn variant="primary" disabled={loading || busy} onClick={() => open('create')}>{spec.create === 'payroll' ? 'Generate payroll drafts' : `Create ${spec.label.toLowerCase()}`}</Btn>}
    </div>
    {spec?.readOnly && <p className="text-sm text-ink-soft mb-4">This history is generated by operational actions. Use handover and return, battery swaps, or wallet credits to add entries and preserve the audit trail.</p>}
    {error && !dialog && <p role="alert" className="text-signal-red mb-3">{error}</p>}
    {message && <p role="status" className="text-accent mb-3">{message}</p>}
    {loading ? <p role="status">Loading records…</p> : <Table><thead><tr>{columns.map(name => <TH key={name}>{spec?.fields.find(field => field.name === name)?.label || name}</TH>)}<TH>Actions</TH></tr></thead><tbody>
      {rows.map(row => <TR key={row.id}>{columns.map(name => <TD key={name}><span className="block max-w-[210px] truncate" title={format(row[name])}>{format(row[name])}</span></TD>)}<TD><div className="flex gap-2"><Btn onClick={() => open('view', row)}>View</Btn>{!spec?.readOnly && <><Btn onClick={() => open('edit', row)}>Edit</Btn><Btn variant="danger" onClick={() => open('remove', row)}>{removalLabels[spec?.remove || ''] || 'Delete'}</Btn></>}</div></TD></TR>)}
      {!rows.length && <TR><TD colSpan={columns.length + 1}>No records found.</TD></TR>}
    </tbody></Table>}
    <div className="flex items-center justify-between mt-4"><span className="text-sm">{total} records · Page {page}</span><div className="flex gap-2"><Btn disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Btn><Btn disabled={page * 25 >= total || loading} onClick={() => setPage(page + 1)}>Next</Btn></div></div>
    {dialog && spec && <Modal title={`${dialog.mode === 'remove' ? removalLabels[spec.remove || ''] || 'Delete' : dialog.mode === 'create' ? 'Create' : dialog.mode === 'edit' ? 'Edit' : 'View'} ${spec.label.toLowerCase()}`} onClose={() => { if (!busy) { setDialog(null); setError(''); } }} wide>
      {dialog.mode === 'view' ? <dl className="grid grid-cols-[minmax(100px,1fr)_2fr] gap-2">{Object.entries(dialog.row!).map(([key, value]) => <React.Fragment key={key}><dt className="font-medium">{spec.fields.find(field => field.name === key)?.label || key}</dt><dd className="break-all whitespace-pre-wrap">{format(value)}</dd></React.Fragment>)}</dl> : <form onSubmit={save} className="space-y-4">
        {dialog.mode === 'remove' ? <><p>{spec.remove ? 'This action changes the record and preserves its history.' : 'Delete this record? Records used elsewhere cannot be deleted.'} Selected record: <strong>{rowLabel(dialog.row!)}</strong>.</p>{spec.remove === 'refundPayment' && <p>This records an offline refund. Confirm that the money was returned separately.</p>}{spec.remove === 'closeRecovery' && <p>Confirm that the vehicle has been recovered. Closing updates the rental and vehicle state.</p>}{spec.remove === 'correctAttendance' && <p>The workday will be marked absent with your reason; the correction history is retained.</p>}{spec.remove === 'returnRental' && <p>Confirm that the physical vehicle has been returned to the hub.</p>}<Field label="Reason"><textarea className={input} required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></Field></> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{spec.fields.filter(field => dialog.mode === 'create' ? !field.editOnly : !field.createOnly).map(field => <Field key={field.name} label={field.label}>{field.lookup ? <Lookup field={field} value={values[field.name] || ''} onChange={value => setValues(old => ({ ...old, [field.name]: value }))} /> : field.options ? <select className={input} required={field.required} value={values[field.name] || ''} onChange={e => setValues(old => ({ ...old, [field.name]: e.target.value }))}><option value="">Select</option>{field.options.map(option => <option key={option}>{option}</option>)}</select> : field.type === 'boolean' ? <input type="checkbox" checked={!!values[field.name]} onChange={e => setValues(old => ({ ...old, [field.name]: e.target.checked }))} /> : <input className={input} type={field.type === 'date' ? field.name === 'date' ? 'date' : 'datetime-local' : field.type === 'number' ? 'number' : 'text'} required={field.required} min={field.name === 'lat' ? -90 : field.name === 'lng' ? -180 : field.min} max={field.max} step={['lat', 'lng'].includes(field.name) ? 'any' : field.type === 'number' ? 1 : undefined} value={values[field.name] ?? ''} onChange={e => setValues(old => ({ ...old, [field.name]: e.target.value }))} />}</Field>)}</div>}
        {error && <p role="alert" className="text-signal-red">{error}</p>}
        <div className="flex gap-2"><Btn type="submit" variant={dialog.mode === 'remove' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Saving…' : dialog.mode === 'remove' ? 'Confirm action' : 'Save'}</Btn><Btn type="button" disabled={busy} onClick={() => { setDialog(null); setError(''); }}>Cancel</Btn></div>
      </form>}
    </Modal>}
  </Card>;
}
