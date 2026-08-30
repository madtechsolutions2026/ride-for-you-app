import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows, spacing } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
};

export function ThemedModal({
  visible,
  title,
  message,
  icon = 'information-circle-outline',
  iconColor = colors.brand.primary,
  confirmLabel = 'OK',
  cancelLabel,
  isDestructive = false,
  onConfirm,
  onCancel,
  children,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel || onConfirm}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={[styles.iconWrapper, { backgroundColor: isDestructive ? '#FEE2E2' : '#DCFCE7' }]}>
            <Ionicons
              name={icon}
              size={28}
              color={isDestructive ? colors.status.error : iconColor}
            />
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Optional custom children */}
          {children}

          {/* Action Button Row */}
          <View style={styles.btnRow}>
            {cancelLabel ? (
              <Pressable
                style={styles.cancelBtn}
                onPress={onCancel}
                hitSlop={4}
              >
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[
                styles.confirmBtn,
                { backgroundColor: isDestructive ? colors.status.error : colors.brand.primary },
              ]}
              onPress={onConfirm}
              hitSlop={4}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.pill,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text.secondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
