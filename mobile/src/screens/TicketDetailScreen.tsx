import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TicketDetail'>;

/**
 * One support ticket as a conversation.
 *
 * Before this screen the rider could only see a one-way "resolution note" in
 * the ticket list — there was no way to answer a follow-up question, send a
 * photo, or say "this is still broken". Replying to a resolved ticket reopens
 * it server-side, which is the honest behaviour: if the rider is still
 * writing, it is not resolved.
 */

interface Ticket {
  id: string;
  ticketNumber: string;
  category: string;
  subject?: string | null;
  description: string;
  status: string;
  adminNotes?: string | null;
  createdAt: string;
}

interface Message {
  id: string;
  authorType: 'RIDER' | 'AGENT';
  body: string;
  attachmentUrl?: string | null;
  createdAt: string;
  author?: { fullName?: string | null } | null;
}

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  OPEN: { bg: colors.status.errorTint, fg: colors.status.error, label: 'Open' },
  IN_PROGRESS: {
    bg: colors.status.warningTint,
    fg: colors.status.warning,
    label: 'In progress',
  },
  RESOLVED: { bg: colors.status.successTint, fg: colors.status.success, label: 'Resolved' },
  CLOSED: { bg: colors.neutral[100], fg: colors.neutral[500], label: 'Closed' },
};

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function TicketDetailScreen({ navigation, route }: Props) {
  const { ticketId } = route.params;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const [t, m] = await Promise.all([
        apiClient.get(`/support/${ticketId}`),
        apiClient.get(`/support/${ticketId}/messages`),
      ]);
      setTicket(t.data?.data ?? null);
      setMessages(m.data?.data ?? []);
      setError(null);
    } catch {
      setError('Could not load this ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access is needed to attach an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) setAttachment(result.assets[0]);
  };

  const send = async () => {
    const body = draft.trim();
    if (!body && !attachment) return;

    setSending(true);
    setError(null);

    try {
      // multipart either way — the backend accepts a body-only reply too.
      const form = new FormData();
      form.append('body', body);
      if (attachment) {
        form.append('file', {
          uri: attachment.uri,
          name: attachment.fileName ?? `reply-${Date.now()}.jpg`,
          type: attachment.mimeType ?? 'image/jpeg',
        } as unknown as Blob);
      }

      const res = await apiClient.post(`/support/${ticketId}/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessages((prev) => [...prev, res.data.data]);
      setDraft('');
      setAttachment(null);

      // A reply on a closed ticket reopens it — reflect that in the header.
      if (res.data?.reopened) {
        setTicket((prev) => (prev ? { ...prev, status: 'OPEN' } : prev));
      }

      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not send your reply. Try again.');
    } finally {
      setSending(false);
    }
  };

  const tone = STATUS_TONE[ticket?.status ?? 'OPEN'] ?? STATUS_TONE.OPEN;
  const canSend = (draft.trim().length > 0 || !!attachment) && !sending;

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{ticket?.ticketNumber ?? 'Ticket'}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {ticket?.subject || ticket?.category}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusText, { color: tone.fg }]}>{tone.label}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {/* The ticket's own description is the first message in the thread. */}
        {ticket && (
          <View style={[styles.bubble, styles.bubbleRider]}>
            <Text style={styles.bubbleTextRider}>{ticket.description}</Text>
            <Text style={styles.bubbleTimeRider}>{timeLabel(ticket.createdAt)}</Text>
          </View>
        )}

        {messages.map((m) => {
          const mine = m.authorType === 'RIDER';
          return (
            <View
              key={m.id}
              style={[styles.bubble, mine ? styles.bubbleRider : styles.bubbleAgent]}
            >
              {!mine && (
                <View style={styles.agentTag}>
                  <Ionicons
                    name="shield-checkmark"
                    size={11}
                    color={colors.brand.primary}
                  />
                  <Text style={styles.agentTagText}>
                    {m.author?.fullName || 'Support desk'}
                  </Text>
                </View>
              )}

              {!!m.attachmentUrl && (
                <Image source={{ uri: m.attachmentUrl }} style={styles.attachment} />
              )}

              {!!m.body && (
                <Text style={mine ? styles.bubbleTextRider : styles.bubbleTextAgent}>
                  {m.body}
                </Text>
              )}

              <Text style={mine ? styles.bubbleTimeRider : styles.bubbleTimeAgent}>
                {timeLabel(m.createdAt)}
              </Text>
            </View>
          );
        })}

        {/* Legacy tickets carry a one-way resolution note with no thread. */}
        {!!ticket?.adminNotes && (
          <View style={[styles.bubble, styles.bubbleAgent]}>
            <View style={styles.agentTag}>
              <Ionicons name="shield-checkmark" size={11} color={colors.brand.primary} />
              <Text style={styles.agentTagText}>Resolution note</Text>
            </View>
            <Text style={styles.bubbleTextAgent}>{ticket.adminNotes}</Text>
          </View>
        )}

        {(ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED') && (
          <View style={styles.reopenHint}>
            <Ionicons name="refresh-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.reopenText}>
              This ticket is closed. Replying below reopens it.
            </Text>
          </View>
        )}
      </ScrollView>

      {error && (
        <View style={styles.errorBar}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {attachment && (
        <View style={styles.attachPreview}>
          <Image source={{ uri: attachment.uri }} style={styles.attachThumb} />
          <Text style={styles.attachName} numberOfLines={1}>
            Photo attached
          </Text>
          <Pressable onPress={() => setAttachment(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
          </Pressable>
        </View>
      )}

      <View style={styles.composer}>
        <Pressable style={styles.attachBtn} onPress={pickImage} hitSlop={8}>
          <Ionicons name="image-outline" size={20} color={colors.text.secondary} />
        </Pressable>

        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a reply…"
          placeholderTextColor={colors.text.secondary}
          multiline
          maxLength={2000}
        />

        <Pressable
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!canSend}
          accessibilityLabel="Send reply"
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.common.white} />
          ) : (
            <Ionicons name="send" size={17} color={colors.common.white} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  centered: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: screenPadding,
    paddingTop: 56,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: 2 },
  headerTitle: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.text.primary },
  headerSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusText: { fontFamily: fontFamily.bold, fontSize: 10 },

  scroll: { padding: screenPadding, paddingBottom: spacing.md },

  bubble: {
    maxWidth: '85%',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  bubbleRider: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface.card,
    borderBottomLeftRadius: 4,
    ...shadows.subtle,
  },
  bubbleTextRider: {
    fontFamily: fontFamily.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.text.inverse,
  },
  bubbleTextAgent: {
    fontFamily: fontFamily.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.text.primary,
  },
  bubbleTimeRider: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: colors.overlay.onAccent,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeAgent: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: 4,
  },

  agentTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  agentTagText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
    color: colors.brand.primary,
  },

  attachment: {
    width: '100%',
    height: 160,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.neutral[100],
  },

  reopenHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  reopenText: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
  },

  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.sm,
    backgroundColor: colors.status.errorTint,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.status.error,
  },

  attachPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[50],
  },
  attachThumb: { width: 34, height: 34, borderRadius: radius.sm },
  attachName: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.text.primary,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 26,
    backgroundColor: colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attachBtn: { paddingBottom: 9 },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: fontFamily.regular,
    fontSize: 13.5,
    color: colors.text.primary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.state.disabledMid },
});
