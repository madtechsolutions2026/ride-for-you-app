export type RootStackParamList = {
  RequestOtp: undefined;
  VerifyOtp: { challengeId: string; phone: string };
  Home: undefined;
  Profile: undefined;
  VehiclesList: {
    categoryId: 'swap' | 'home';
    categoryTitle: string;
    hubId: string;
    hubName: string;
    hubAddress: string;
  };
  // Booking flow: VehiclesList -> BookingPayment -> BookingConfirmed
  BookingPayment: { bookingId: string };
  BookingConfirmed: { bookingId: string };
  MyBookings: undefined;
  MyRental: { payInvoiceId?: string } | undefined;
  Support: undefined;
  RaiseTicket: { bookingId?: string } | undefined;

  /** One ticket as a conversation with the helpdesk. */
  TicketDetail: { ticketId: string };
  /** Company-issued credit and its ledger. No top-up — see the backend note. */
  Wallet: undefined;
  /** The durable inbox behind every push. */
  Notifications: undefined;
  /** Scan a dock QR to swap a battery mid-rental. */
  BatterySwap: undefined;
  /** Ask to extend the rental, or book a slot to hand the bike back. */
  RentalRequest: { type?: 'EXTENSION' | 'RETURN' } | undefined;
  /** Rider-side damage report with photos. */
  ReportDamage: undefined;
  /** Static helmet-fit and road-safety guide. */
  SafetyGuide: undefined;
};
