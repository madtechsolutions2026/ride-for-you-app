import React from 'react';
import { Text, Pressable } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { useNotifications } from './useNotifications';
import { apiClient } from '../api/client';

/**
 * These replace `SAMPLE_NOTIFICATIONS` — three hardcoded rows the app showed
 * every rider regardless of what had actually happened to them.
 */

jest.mock('../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'n1',
  category: 'PAYMENT',
  title: 'Rent due tomorrow',
  body: '₹1,645 for week 2.',
  readAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

/** Minimal harness — renders the hook's state and exposes its actions. */
function Harness() {
  const { notifications, unreadCount, loading, error, markRead, markAllRead } =
    useNotifications();

  return (
    <>
      <Text testID="loading">{String(loading)}</Text>
      <Text testID="count">{String(unreadCount)}</Text>
      <Text testID="len">{String(notifications.length)}</Text>
      <Text testID="error">{error ?? ''}</Text>
      <Pressable testID="read" onPress={() => markRead('n1')}>
        <Text>read</Text>
      </Pressable>
      <Pressable testID="readAll" onPress={markAllRead}>
        <Text>readAll</Text>
      </Pressable>
    </>
  );
}

describe('useNotifications', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('loads the real inbox and unread count', async () => {
    mockGet.mockResolvedValue({
      data: { data: { notifications: [row(), row({ id: 'n2', readAt: '2026-09-01' })], unreadCount: 1 } },
    });

    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    expect(screen.getByTestId('len').props.children).toBe('2');
    expect(screen.getByTestId('count').props.children).toBe('1');
    expect(mockGet).toHaveBeenCalledWith('/user/notifications');
  });

  it('reports an error instead of showing stale placeholder rows', async () => {
    mockGet.mockRejectedValue(new Error('offline'));

    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    expect(screen.getByTestId('len').props.children).toBe('0');
    expect(screen.getByTestId('error').props.children).toMatch(/Could not load/);
  });

  it('marks one read optimistically and takes the server count', async () => {
    mockGet.mockResolvedValue({ data: { data: { notifications: [row()], unreadCount: 1 } } });
    mockPost.mockResolvedValue({ data: { data: { unreadCount: 0 } } });

    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe('1'));

    fireEvent.press(screen.getByTestId('read'));

    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe('0'));
    expect(mockPost).toHaveBeenCalledWith('/user/notifications/n1/read');
  });

  it('re-syncs from the server when marking read fails', async () => {
    mockGet.mockResolvedValue({ data: { data: { notifications: [row()], unreadCount: 1 } } });
    mockPost.mockRejectedValue(new Error('offline'));

    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe('1'));

    fireEvent.press(screen.getByTestId('read'));

    // The optimistic decrement is rolled back by a refetch, so the count
    // returns to what the server actually holds.
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe('1'));
  });

  it('clears the badge on mark-all-read', async () => {
    mockGet.mockResolvedValue({
      data: { data: { notifications: [row(), row({ id: 'n2' })], unreadCount: 2 } },
    });
    mockPost.mockResolvedValue({ data: { data: { marked: 2, unreadCount: 0 } } });

    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe('2'));

    fireEvent.press(screen.getByTestId('readAll'));

    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe('0'));
    expect(mockPost).toHaveBeenCalledWith('/user/notifications/read-all');
  });
});
