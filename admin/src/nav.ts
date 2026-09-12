import {
  LayoutDashboard, Users, Bike, ClipboardList, FileCheck2, Receipt,
  Wrench, Truck, BarChart3, MapPin, Settings, UserCog, Headphones,
} from 'lucide-react';

export interface NavTab {
  label: string;
  path: string;
}

export interface NavItem {
  /** Permission key checked by AuthContext.can() — must match ROLE_DEFAULT_SCREENS. */
  id: string;
  label: string;
  path: string;
  title: string;
  subtitle: string;
  icon: typeof LayoutDashboard;
  tabs?: NavTab[];
  badge?: 'pendingKyc' | 'openTickets' | 'pendingRequests' | 'openCollections';
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Core',
    items: [
      {
        id: 'overview', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard,
        title: 'Dashboard',
        subtitle: 'Live fleet, rentals, billing and verification at a glance',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        id: 'riders', label: 'Riders', path: '/riders', icon: Users,
        title: 'Riders',
        subtitle: 'Onboarding accounts, active riders and account status',
      },
      {
        id: 'bookings', label: 'Bookings & Rentals', path: '/bookings', icon: ClipboardList,
        title: 'Bookings & Rentals',
        subtitle: 'Confirm bookings, hand over bikes, take returns',
        badge: 'pendingRequests',
        tabs: [
          { label: 'Bookings & rentals', path: '/bookings/list' },
          { label: 'Rider requests', path: '/bookings/requests' },
        ],
      },
      {
        id: 'fleet', label: 'Vehicles & Fleet', path: '/fleet', icon: Bike,
        title: 'Vehicles & Fleet',
        subtitle: 'Models, pricing plans, physical bikes and battery levels',
      },
      {
        id: 'kyc', label: 'KYC Approvals', path: '/kyc', icon: FileCheck2,
        title: 'KYC Approvals',
        subtitle: 'Inspect Aadhaar, address proofs and selfies',
        badge: 'pendingKyc',
      },
      {
        id: 'infrastructure', label: 'Hubs & Stations', path: '/network', icon: MapPin,
        title: 'Network',
        subtitle: 'Pick-up points and battery-swap docks',
        tabs: [
          { label: 'Hubs', path: '/network/hubs' },
          { label: 'Swap Stations', path: '/network/swap-stations' },
        ],
      },
    ],
  },
  {
    title: 'Finance & Billing',
    items: [
      {
        id: 'finance', label: 'P&L & Expenses', path: '/finance', icon: Receipt,
        title: 'Finance',
        subtitle: 'Net summary, operating expenses and weekly billing',
      },
    ],
  },
  {
    title: 'Service & Helpdesk',
    items: [
      {
        id: 'service', label: 'Service & Damage', path: '/service', icon: Wrench,
        title: 'Service & Damage',
        subtitle: 'Technicians, service tickets, parts and damage reports',
        tabs: [
          { label: 'Tickets', path: '/service/tickets' },
          { label: 'Technicians', path: '/service/technicians' },
          { label: 'Damage', path: '/service/damage' },
        ],
      },
      {
        id: 'recovery', label: 'Recovery & Collections', path: '/recovery', icon: Truck,
        title: 'Recovery',
        subtitle: 'Breakdown dispatch, theft, police holds and unpaid-rent collections',
        badge: 'openCollections',
        tabs: [
          { label: 'Collections', path: '/recovery/collections' },
          { label: 'Roadside & Police', path: '/recovery/roadside' },
        ],
      },
      {
        id: 'support', label: 'Support Helpdesk', path: '/support', icon: Headphones,
        title: 'Support Helpdesk',
        subtitle: 'Incoming rider issues, bike complaints and resolutions',
        badge: 'openTickets',
      },
    ],
  },
  {
    title: 'Organisation',
    items: [
      {
        id: 'employees', label: 'Employees & Payroll', path: '/people', icon: UserCog,
        title: 'Employees & Payroll',
        subtitle: 'Hierarchy, attendance calendar and payroll sheets',
      },
      {
        id: 'reports', label: 'Reports & MRR', path: '/reports', icon: BarChart3,
        title: 'Reports & MRR',
        subtitle: 'Recurring revenue and operational trends',
      },
      {
        id: 'settings', label: 'Pricing & System', path: '/settings', icon: Settings,
        title: 'Pricing & System',
        subtitle: 'Rental plan pricing and integration status',
        tabs: [
          { label: 'Pricing', path: '/settings/pricing' },
          { label: 'Integrations', path: '/settings/integrations' },
        ],
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV.flatMap((s) => s.items);

/** Permission key, e.g. 'overview' | 'fleet' | 'kyc'. */
export type ScreenId = string;

export const pathForScreen = (id: ScreenId): string =>
  NAV_ITEMS.find((i) => i.id === id)?.path ?? '/dashboard';

/** Longest-prefix match so /riders/:id still resolves to the Riders item. */
export const itemForPath = (pathname: string): NavItem | undefined =>
  NAV_ITEMS.filter((i) => pathname === i.path || pathname.startsWith(i.path + '/')).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
