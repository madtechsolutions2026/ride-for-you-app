import React, { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { NeoSurface, BottomNav, BOTTOM_NAV_HEIGHT } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Support'>;

type SupportTicket = {
  id: string;
  ticketNumber: string;
  category: string;
  _count?: { messages: number };
  subject?: string;
  description: string;
  status: string;
  adminNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  booking?: {
    id: string;
    status: string;
    model?: { name: string };
  };
};

const FAQS = [
  {
    q: 'How does Battery Swapping work?',
    a: 'Visit any of our 50+ Hubs or Swap Docks in the city. Scan the QR code, exchange your drained battery for a 100% charged battery in under 2 minutes.',
  },
  {
    q: 'What if my bike breaks down on the road?',
    a: 'We provide 24/7 Roadside Assistance. Call our helpline or raise an urgent Breakdown ticket, and our mobile support van will reach you.',
  },
  {
    q: 'How do weekly rental payments work?',
    a: 'Rent is charged on a 7-day recurring cycle. You can pay your weekly invoice via UPI, card, or net banking directly in the app.',
  },
  {
    q: 'Can I book multiple bikes at once?',
    a: 'No, riders can have only ONE active booking at a time to ensure vehicle availability. Once returned, you can book another.',
  },
];

export default function SupportScreen({ navigation }: Props) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/support');
      setTickets(res.data.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTickets();
    });
    return unsubscribe;
  }, [navigation]);

  const handleCall = () => {
    Linking.openURL('tel:+918000000000').catch(() => {});
  };

  const handleWhatsApp = () => {
    Linking.openURL('whatsapp://send?phone=918000000000&text=Hi%20Ride%20For%20You%20Support%20Team').catch(() => {});
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Rider Support & Help</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Urgent Contact Cards */}
        <View style={styles.quickContactsRow}>
          <Pressable style={styles.contactCard} onPress={handleCall}>
            <View style={[styles.contactIconBg, { backgroundColor: '#EAF8F1' }]}>
              <Ionicons name="call" size={20} color={colors.brand.primary} />
            </View>
            <Text style={styles.contactTitle}>Call Helpline</Text>
            <Text style={styles.contactSub}>24/7 Roadside</Text>
          </Pressable>

          <Pressable style={styles.contactCard} onPress={handleWhatsApp}>
            <View style={[styles.contactIconBg, { backgroundColor: '#EBF8FF' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#0088CC" />
            </View>
            <Text style={styles.contactTitle}>WhatsApp</Text>
            <Text style={styles.contactSub}>Quick chat</Text>
          </Pressable>
        </View>

        {/* Raise Ticket CTA */}
        <NeoSurface borderRadius={radius.lg} style={styles.raiseCard}>
          <View style={styles.raiseLeft}>
            <View style={styles.raiseIconHalo}>
              <Ionicons name="chatbox-ellipses" size={24} color={colors.brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.raiseHeading}>Have an issue or complaint?</Text>
              <Text style={styles.raiseSub}>
                Submit a support ticket and our operations desk will resolve it promptly.
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.raiseBtn}
            onPress={() => navigation.navigate('RaiseTicket')}
          >
            <Text style={styles.raiseBtnText}>Raise a Ticket</Text>
            <Ionicons name="add" size={18} color={colors.common.white} />
          </Pressable>
        </NeoSurface>

        {/* My Tickets Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My Support Tickets</Text>
            <Pressable onPress={fetchTickets} hitSlop={8}>
              <Ionicons name="refresh" size={18} color={colors.brand.primary} />
            </Pressable>
          </View>

          {tickets.length === 0 ? (
            <View style={styles.emptyTickets}>
              <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
              <Text style={styles.emptyTicketsText}>No support tickets submitted</Text>
            </View>
          ) : (
            <View style={styles.ticketsList}>
              {tickets.map((ticket) => {
                const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
                const isOpen = ticket.status === 'OPEN';

                const replyCount = ticket._count?.messages ?? 0;

                return (
                  <Pressable
                    key={ticket.id}
                    style={styles.ticketCard}
                    onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ticket ${ticket.ticketNumber}`}
                  >
                    <View style={styles.ticketHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.ticketNumber}>{ticket.ticketNumber}</Text>
                          <View
                            style={[
                              styles.statusBadge,
                              isOpen
                                ? styles.statusOpen
                                : isResolved
                                ? styles.statusResolved
                                : styles.statusInProgress,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                isOpen
                                  ? { color: '#EF4444' }
                                  : isResolved
                                  ? { color: '#10B981' }
                                  : { color: '#F59E0B' },
                              ]}
                            >
                              {ticket.status}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.ticketSubject}>{ticket.subject || ticket.category}</Text>
                      </View>

                      <Text style={styles.ticketDate}>
                        {new Date(ticket.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </Text>
                    </View>

                    <Text style={styles.ticketDesc} numberOfLines={2}>
                      {ticket.description}
                    </Text>

                    <View style={styles.ticketFooter}>
                      <Text style={styles.ticketReplies}>
                        {replyCount === 0
                          ? 'No replies yet'
                          : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                      </Text>
                      <View style={styles.ticketOpenRow}>
                        <Text style={styles.ticketOpenText}>Open conversation</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={13}
                          color={colors.brand.primary}
                        />
                      </View>
                    </View>

                    {ticket.adminNotes && (
                      <View style={styles.adminNotesBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <Ionicons name="shield-checkmark" size={12} color={colors.brand.primary} />
                          <Text style={styles.adminNotesTitle}>Resolution Note from Helpdesk:</Text>
                        </View>
                        <Text style={styles.adminNotesText}>{ticket.adminNotes}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* FAQs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {FAQS.map((faq, idx) => {
              const isExpanded = expandedFaq === idx;
              return (
                <Pressable
                  key={idx}
                  style={styles.faqCard}
                  onPress={() => setExpandedFaq(isExpanded ? null : idx)}
                >
                  <View style={styles.faqQuestionRow}>
                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.text.secondary}
                    />
                  </View>
                  {isExpanded && <Text style={styles.faqAnswer}>{faq.a}</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <BottomNav active="support" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFCFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.sm,
    backgroundColor: colors.common.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  scroll: {
    padding: screenPadding,
    paddingBottom: BOTTOM_NAV_HEIGHT + spacing.lg,
  },

  quickContactsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.md,
  },
  contactCard: {
    flex: 1,
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...shadows.subtle,
  },
  contactIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  contactTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.text.primary,
  },
  contactSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },

  raiseCard: {
    padding: 16,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  raiseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  raiseIconHalo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raiseHeading: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.text.primary,
  },
  raiseSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 16,
  },
  raiseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand.primary,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  raiseBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.common.white,
  },

  section: {
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  emptyTickets: {
    backgroundColor: colors.common.white,
    borderRadius: radius.md,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  emptyTicketsText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },

  ticketsList: {
    gap: 10,
  },
  ticketCard: {
    backgroundColor: colors.common.white,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...shadows.subtle,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  ticketNumber: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.text.primary,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ticketSubject: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.text.primary,
    marginTop: 4,
  },
  ticketDate: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusOpen: { backgroundColor: '#FEE2E2' },
  statusInProgress: { backgroundColor: '#FEF3C7' },
  statusResolved: { backgroundColor: '#D1FAE5' },
  statusBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 9.5,
  },
  ticketDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 17,
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ticketReplies: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.text.secondary,
  },
  ticketOpenRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ticketOpenText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11.5,
    color: colors.brand.primary,
  },
  adminNotesBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  adminNotesTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 10.5,
    color: '#166534',
  },
  adminNotesText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#15803D',
  },

  faqList: {
    gap: 8,
  },
  faqCard: {
    backgroundColor: colors.common.white,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text.primary,
    paddingRight: 8,
  },
  faqAnswer: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 17,
  },
});
