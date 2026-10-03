import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { BottomNav } from './BottomNav';

/**
 * The bar these tests cover replaced two divergent copies, one of which had
 * four of five buttons wired to `() => {}`. That bug was invisible because
 * nothing asserted a tap did anything — so this file asserts exactly that.
 */

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe('BottomNav', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renders all five destinations', () => {
    render(<BottomNav active="home" />);

    for (const label of ['Home', 'Bookings', 'Wallet', 'Support', 'Profile']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('every inactive tab navigates — none is a no-op', () => {
    render(<BottomNav active="home" />);

    const expected: Record<string, string> = {
      Bookings: 'MyBookings',
      Wallet: 'Wallet',
      Support: 'Support',
      Profile: 'Profile',
    };

    for (const [label, route] of Object.entries(expected)) {
      mockNavigate.mockClear();
      fireEvent.press(screen.getByText(label));
      expect(mockNavigate).toHaveBeenCalledWith(route);
    }
  });

  it('tapping the active tab does not push a duplicate screen', () => {
    render(<BottomNav active="wallet" />);

    fireEvent.press(screen.getByText('Wallet'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows no badge by default', () => {
    render(<BottomNav active="home" />);

    expect(screen.queryByLabelText(/needing attention/)).toBeNull();
  });

  it('shows a real support badge and caps it at 9+', () => {
    const { rerender } = render(<BottomNav active="home" supportBadge={3} />);
    expect(screen.getByText('3')).toBeTruthy();

    rerender(<BottomNav active="home" supportBadge={42} />);
    expect(screen.getByText('9+')).toBeTruthy();
  });

  it('marks the active tab as selected for screen readers', () => {
    render(<BottomNav active="profile" />);

    const profile = screen.getByLabelText('Profile');
    expect(profile.props.accessibilityState.selected).toBe(true);

    const home = screen.getByLabelText('Home');
    expect(home.props.accessibilityState.selected).toBe(false);
  });
});
