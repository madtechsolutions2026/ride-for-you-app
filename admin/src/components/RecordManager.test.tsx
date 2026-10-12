import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordManager } from './RecordManager';
import { apiClient } from '../api/client';
vi.mock('../api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../context/RefreshContext', () => ({ usePageRefresh: vi.fn() }));
const hub = { id: 'h1', name: 'Central', address: 'Main road', lat: 17.4, lng: 78.4, status: 'ACTIVE' };
const fields = [
  { name: 'name', label: 'Name', required: true }, { name: 'address', label: 'Address', required: true },
  { name: 'lat', label: 'Latitude', type: 'number', required: true }, { name: 'lng', label: 'Longitude', type: 'number', required: true },
];
const catalog = { hubs: { label: 'Hubs', sections: ['infrastructure'], fields }, wallet: { label: 'Wallet ledger', sections: ['finance'], fields: [], readOnly: true } };
beforeEach(() => {
  vi.mocked(apiClient.get).mockReset(); vi.mocked(apiClient.post).mockReset(); vi.mocked(apiClient.put).mockReset(); vi.mocked(apiClient.delete).mockReset();
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/admin/api/records' ? { data: catalog } : { data: [hub], total: 1 } }) as any);
  vi.mocked(apiClient.post).mockResolvedValue({ data: {} } as any);
  vi.mocked(apiClient.put).mockResolvedValue({ data: {} } as any);
  vi.mocked(apiClient.delete).mockResolvedValue({ data: {} } as any);
});
describe('Admin record manager', () => {
  it('loads section records and displays details', async () => {
    render(<RecordManager section="infrastructure" />);
    await screen.findByText('Central');
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(screen.getAllByText('Main road').length).toBeGreaterThan(0);
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('/admin/api/records/hubs', { params: { page: 1, search: '' } });
  });
  it('creates using structured fields and numeric coordinates', async () => {
    render(<RecordManager section="infrastructure" />);
    await screen.findByText('Central');
    fireEvent.click(screen.getByRole('button', { name: 'Create hubs' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'West' } });
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'West road' } });
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-17.2' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '78.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/admin/api/records/hubs', { name: 'West', address: 'West road', lat: -17.2, lng: 78.2 }));
    await screen.findByText('Saved successfully.');
  });
  it('updates a selected record', async () => {
    render(<RecordManager section="infrastructure" />); await screen.findByText('Central');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/admin/api/records/hubs/h1', expect.objectContaining({ name: 'Renamed' })));
  });
  it('requires explicit confirmation and sends the removal reason', async () => {
    render(<RecordManager section="infrastructure" />); await screen.findByText('Central');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(apiClient.delete).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Duplicate hub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/admin/api/records/hubs/h1', { data: { reason: 'Duplicate hub' } }));
  });
  it('keeps the edit dialog open and shows server validation errors', async () => {
    vi.mocked(apiClient.put).mockRejectedValue({ response: { data: { error: 'Record is linked' } } });
    render(<RecordManager section="infrastructure" />); await screen.findByText('Central');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' })); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Record is linked');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
  it('shows preserved history without mutation controls', async () => {
    render(<RecordManager section="finance" />); await screen.findByRole('button', { name: 'View' });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create/ })).not.toBeInTheDocument();
  });
  it('does not expose other sections in the section selector', async () => {
    render(<RecordManager section="infrastructure" />); await screen.findByText('Central');
    expect(screen.queryByRole('option', { name: 'Wallet ledger' })).not.toBeInTheDocument();
  });
});
