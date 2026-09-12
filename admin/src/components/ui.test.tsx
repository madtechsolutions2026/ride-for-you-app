import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toneFor, rupees, Pill, Tabs, Stat, EmptyState } from './ui';

describe('toneFor', () => {
  it('maps settled and healthy states to green', () => {
    for (const s of ['PAID', 'APPROVED', 'ACTIVE', 'COMPLETED', 'CONFIRMED']) {
      expect(toneFor(s)).toBe('green');
    }
  });

  it('maps in-flight states to amber', () => {
    for (const s of ['PENDING', 'SUBMITTED', 'OPEN', 'HANDED_OVER']) {
      expect(toneFor(s)).toBe('amber');
    }
  });

  it('maps failure states to red', () => {
    for (const s of ['OVERDUE', 'FAILED', 'REJECTED', 'CANCELLED']) {
      expect(toneFor(s)).toBe('red');
    }
  });

  it('is case insensitive', () => {
    expect(toneFor('paid')).toBe('green');
    expect(toneFor('Overdue')).toBe('red');
  });

  it('does not throw on empty or unknown input', () => {
    expect(toneFor('')).toBe('blue');
    expect(toneFor('SOMETHING_NEW')).toBe('blue');
  });
});

describe('rupees', () => {
  it('formats with the Indian digit grouping', () => {
    expect(rupees(150000)).toBe('₹1,50,000');
    expect(rupees(1500)).toBe('₹1,500');
  });

  it('rounds to whole rupees', () => {
    expect(rupees(1499.6)).toBe('₹1,500');
  });

  it('treats null, undefined and zero as ₹0 rather than NaN', () => {
    expect(rupees(null)).toBe('₹0');
    expect(rupees(undefined)).toBe('₹0');
    expect(rupees(0)).toBe('₹0');
  });
});

describe('Pill', () => {
  it('renders its label', () => {
    render(<Pill tone="green">Online</Pill>);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
});

describe('Stat', () => {
  it('shows the label, value and hint', () => {
    render(<Stat label="Active rentals" value={12} hint="2 overdue" tone="amber" />);
    expect(screen.getByText('Active rentals')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('2 overdue')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders a title and optional hint', () => {
    render(<EmptyState title="No hubs yet" hint="Add your first centre." />);
    expect(screen.getByText('No hubs yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first centre.')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  const tabs = [
    { label: 'Hubs', path: '/network/hubs' },
    { label: 'Swap Stations', path: '/network/swap-stations' },
  ];

  it('marks only the tab matching the current route as active', () => {
    render(
      <MemoryRouter initialEntries={['/network/hubs']}>
        <Tabs tabs={tabs} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Hubs').className).toContain('border-accent');
    expect(screen.getByText('Swap Stations').className).toContain('border-transparent');
  });

  it('links each tab to its own route', () => {
    render(
      <MemoryRouter initialEntries={['/network/hubs']}>
        <Tabs tabs={tabs} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Swap Stations').closest('a')).toHaveAttribute(
      'href',
      '/network/swap-stations',
    );
  });
});
