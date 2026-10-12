import React from 'react';
import { Text, Pressable } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { distanceLabel, useRentalHubs } from './useRentalHubs';
import { apiClient } from '../api/client';
jest.mock('../api/client', () => ({ apiClient: { get: jest.fn() } }));
const get = apiClient.get as jest.Mock;
function Harness({ visible = true }: { visible?: boolean }) {
  const { hubs, loading, error, refresh } = useRentalHubs(visible);
  return <><Text testID="state">{JSON.stringify({ hubs, loading, error })}</Text><Pressable testID="refresh" onPress={refresh}><Text>Refresh</Text></Pressable></>;
}
const state = () => JSON.parse(screen.getByTestId('state').props.children);
beforeEach(() => get.mockReset());
it('reads actual Bahadurpally data and counts from the shared API', async () => {
  const hub = { id: 'hub_bahadurpally', name: 'Bahadurpally', lat: 17.5654, lng: 78.4379, availableByCategory: { SWAP: 0, HOME: 2 }, totalAvailable: 2 };
  get.mockResolvedValue({ data: { hubs: [hub] } }); render(<Harness />);
  await waitFor(() => expect(state().loading).toBe(false));
  expect(state().hubs).toEqual([hub]); expect(get).toHaveBeenCalledWith('/rental/hubs');
});
it('respects an empty database response', async () => {
  get.mockResolvedValue({ data: { hubs: [] } }); render(<Harness />);
  await waitFor(() => expect(state().loading).toBe(false)); expect(state().hubs).toEqual([]);
});
it('reports connection failure without inventing hubs', async () => {
  get.mockRejectedValue(new Error('offline')); render(<Harness />);
  await waitFor(() => expect(state().loading).toBe(false)); expect(state().hubs).toEqual([]); expect(state().error).toMatch(/Could not load/);
});
it('replaces prior records on refresh after an admin change', async () => {
  get.mockResolvedValueOnce({ data: { hubs: [{ id: 'old', name: 'Old hub' }] } }).mockResolvedValueOnce({ data: { hubs: [] } }); render(<Harness />);
  await waitFor(() => expect(state().hubs).toHaveLength(1)); fireEvent.press(screen.getByTestId('refresh'));
  await waitFor(() => expect(state().loading).toBe(false)); expect(state().hubs).toEqual([]);
});
it('loads again when reopened', async () => {
  get.mockResolvedValue({ data: { hubs: [] } }); const { rerender } = render(<Harness visible={false} />);
  expect(get).not.toHaveBeenCalled(); rerender(<Harness />); await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
});
it('does not fabricate distances', () => { expect(distanceLabel()).toBe('Distance unavailable'); expect(distanceLabel(0)).toBe('0.0 km away'); expect(distanceLabel(1250)).toBe('1.3 km away'); });
