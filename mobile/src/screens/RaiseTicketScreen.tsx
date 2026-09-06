import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { ThemedModal } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'RaiseTicket'>;

const CATEGORIES = [
  { id: 'BIKE_ISSUE', label: 'Bike Issue / Breakdown', icon: 'bicycle' },
  { id: 'PAYMENT', label: 'Payment / Billing', icon: 'card' },
  { id: 'BOOKING', label: 'Booking & Hubs', icon: 'calendar' },
  { id: 'OTHER', label: 'General / App', icon: 'help-circle' },
];

export default function RaiseTicketScreen({ navigation, route }: Props) {
  const [selectedCategory, setSelectedCategory] = useState('BIKE_ISSUE');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      alert('Please provide a subject for your ticket.');
      return;
    }
    if (!description.trim()) {
      alert('Please provide details in the description.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/support', {
        category: selectedCategory,
        subject: subject.trim(),
        description: description.trim(),
        bookingId: route.params?.bookingId,
      });

      const ticketNum = res.data.data?.ticketNumber || 'TKT';
      setSuccessModal(`Ticket ${ticketNum} created successfully. Our team will review and update you soon.`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
        <Text style={styles.headerTitle}>Raise Support Ticket</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Category Picker */}
        <Text style={styles.inputLabel}>Select Issue Category</Text>
        <View style={styles.categoriesGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={18}
                  color={isSelected ? colors.brand.primary : colors.text.secondary}
                />
                <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Subject Input */}
        <Text style={styles.inputLabel}>Subject / Summary</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Brief summary of the issue (e.g. Battery not locking)"
          placeholderTextColor="#94A3B8"
          value={subject}
          onChangeText={setSubject}
        />

        {/* Description Input */}
        <Text style={styles.inputLabel}>Detailed Description</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Please explain what happened, bike registration number if relevant, and location if roadside assistance is required…"
          placeholderTextColor="#94A3B8"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* Info Note */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={colors.brand.primary} />
          <Text style={styles.infoText}>
            Our helpdesk responds within 15–30 minutes during hub operating hours (9 AM – 9 PM).
          </Text>
        </View>

        {/* Submit Button */}
        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.common.white} />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Submit Support Ticket</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.common.white} />
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Success Modal */}
      {successModal && (
        <ThemedModal
          visible={Boolean(successModal)}
          title="Ticket Submitted"
          message={successModal}
          icon="checkmark-circle-outline"
          confirmLabel="View Tickets"
          onConfirm={() => {
            setSuccessModal(null);
            navigation.navigate('Support');
          }}
        />
      )}
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
    paddingBottom: 40,
  },
  inputLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.text.primary,
    marginBottom: 8,
    marginTop: spacing.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.common.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryCardSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.mintSoft,
  },
  categoryLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.text.secondary,
  },
  categoryLabelSelected: {
    fontFamily: fontFamily.bold,
    color: colors.brand.primary,
  },
  textInput: {
    backgroundColor: colors.common.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 110,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brand.mintSoft,
    padding: 12,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brand.mint,
  },
  infoText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand.primary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
    ...shadows.subtle,
  },
  submitBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.common.white,
  },
});
