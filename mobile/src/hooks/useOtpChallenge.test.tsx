import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { publicAuthClient } from '../api/client';
import { useOtpChallenge } from './useOtpChallenge';

jest.mock('../api/client', () => ({ publicAuthClient: { post: jest.fn() } }));
const post = publicAuthClient.post as jest.Mock;
function Harness({ initialId }: { initialId?: string }) {
  const state = useOtpChallenge('+917095682464', initialId);
  return <><Text testID="state">{JSON.stringify(state)}</Text><Pressable testID="retry" onPress={state.request}><Text>Retry</Text></Pressable></>;
}
const state = () => JSON.parse(screen.getByTestId('state').props.children);
beforeEach(() => post.mockReset());

it('shows the OTP screen state while the network request is still pending', () => {
  post.mockReturnValue(new Promise(() => {}));
  render(<Harness />);
  expect(state().sending).toBe(true);
  expect(state().challengeId).toBeUndefined();
  expect(post).toHaveBeenCalledWith('/auth/otp/request', { phone: '+917095682464' });
});
it('enables verification only after a real challenge arrives', async () => {
  post.mockResolvedValue({ data: { challengeId: 'challenge_1', resendAvailableIn: 42 } });
  render(<Harness />);
  await waitFor(() => expect(state().sending).toBe(false));
  expect(state().challengeId).toBe('challenge_1');
  expect(state().retryAfter).toBe(42);
});
it('provides a retry after a timeout without inventing a challenge', async () => {
  post.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ data: { challengeId: 'retry_1' } });
  render(<Harness />);
  await waitFor(() => expect(state().error).toMatch(/connection.*Retry/));
  expect(state().challengeId).toBeUndefined();
  fireEvent.press(screen.getByTestId('retry'));
  await waitFor(() => expect(state().challengeId).toBe('retry_1'));
  expect(state().error).toBe('');
});
it('preserves the server resend throttle', async () => {
  post.mockRejectedValue({ response: { data: { error: 'Please wait', retryAfter: 25 } } });
  render(<Harness />);
  await waitFor(() => expect(state().sending).toBe(false));
  expect(state().retryAfter).toBe(25);
  expect(state().error).toBe('Please wait');
});
it('does not send duplicate requests while the first request is pending', () => {
  post.mockReturnValue(new Promise(() => {}));
  render(<Harness />);
  fireEvent.press(screen.getByTestId('retry'));
  fireEvent.press(screen.getByTestId('retry'));
  expect(post).toHaveBeenCalledTimes(1);
});
it('does not send another code for an existing navigation challenge', () => {
  render(<Harness initialId="existing" />);
  expect(state().challengeId).toBe('existing');
  expect(state().sending).toBe(false);
  expect(post).not.toHaveBeenCalled();
});
it('shows failure when the server response has no challenge', async () => {
  post.mockResolvedValue({ data: {} });
  render(<Harness />);
  await waitFor(() => expect(state().sending).toBe(false));
  expect(state().challengeId).toBeUndefined();
  expect(state().error).toMatch(/connection.*Retry/);
});
