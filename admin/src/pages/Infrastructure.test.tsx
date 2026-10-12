import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Infrastructure } from './Infrastructure';
import { apiClient } from '../api/client';
vi.mock('../api/client', () => ({ apiClient: { get: vi.fn() } }));
beforeEach(() => { vi.mocked(apiClient.get).mockReset(); });
it('shows actual empty stations when the request succeeds', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { hubs: [], swapStations: [] } } as any);
  render(<Infrastructure tab="stations" />);
  expect(await screen.findByText('No swap stations yet')).toBeInTheDocument();
});
it('does not present a failed request as zero stations', async () => {
  vi.mocked(apiClient.get).mockRejectedValue(new Error('Invalid or expired access token'));
  render(<Infrastructure tab="stations" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired access token');
  expect(screen.queryByText('No swap stations yet')).not.toBeInTheDocument();
});
