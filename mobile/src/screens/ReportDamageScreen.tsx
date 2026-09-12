import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { NeoSurface, ThemedModal } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportDamage'>;

/**
 * Rider-side damage report.
 *
 * Lands in the same queue staff already work from, tagged as reported by the
 * rider. It carries no cost estimate on purpose — pricing damage is an
 * inspection decision, not something the app should let a rider set or a
 * rider fear. Saying that on the screen is what makes people report early.
 */

const SEVERITIES = [
  {
    id: 'MINOR' as const,
    label: 'Minor',
    hint: 'Scratches, loose mirror, small dent',
    icon: 'ellipse-outline' as const,
  },
  {
    id: 'MODERATE' as const,
    label: 'Moderate',
    hint: 'Cracked panel, bent guard, light not working',
    icon: 'alert-circle-outline' as const,
  },
  {
    id: 'MAJOR' as const,
    label: 'Major',
    hint: 'Brakes, motor, battery or anything unsafe to ride',
    icon: 'warning-outline' as const,
  },
];

const MAX_PHOTOS = 5;

export default function ReportDamageScreen({ navigation }: Props) {
  const [severity, setSeverity] = useState<'MINOR' | 'MODERATE' | 'MAJOR'>('MINOR');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const addPhoto = async (fromCamera: boolean) => {
    setError(null);

    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        fromCamera
          ? 'Camera access is needed to photograph the damage.'
          : 'Photo access is needed to attach an image.',
      );
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });

    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => [...prev, result.assets[0]].slice(0, MAX_PHOTOS));
    }
  };

  const submit = async () => {
    const text = description.trim();
    if (text.length < 10) {
      setError('Please describe what happened in a little more detail.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('severity', severity);
      form.append('description', text);
      photos.forEach((p, i) => {
        form.append('files', {
          uri: p.uri,
          name: p.fileName ?? `damage-${i}-${Date.now()}.jpg`,
          type: p.mimeType ?? 'image/jpeg',
        } as unknown as Blob);
      });

      const res = await apiClient.post('/rental/damage', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(res.data?.message ?? 'Reported. Our team will take a look.');
      setDescription('');
      setPhotos([]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not submit the report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Report Damage</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.reassure}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.brand.primary} />
          <Text style={styles.reassureText}>
            Reporting early helps us fix the bike faster. Nothing is charged from this screen — our
            team inspects first and talks to you before any cost is raised.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <NeoSurface borderRadius={radius.lg} style={styles.card}>
          <Text style={styles.label}>How bad is it?</Text>
          <View style={styles.severityList}>
            {SEVERITIES.map((s) => {
              const on = severity === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[styles.severity, on && styles.severityOn]}
                  onPress={() => setSeverity(s.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons
                    name={s.icon}
                    size={18}
                    color={on ? colors.brand.primary : colors.text.secondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.severityLabel, on && styles.severityLabelOn]}>
                      {s.label}
                    </Text>
                    <Text style={styles.severityHint}>{s.hint}</Text>
                  </View>
                  {on && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.brand.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: spacing.md }]}>What happened?</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Front mudguard cracked after hitting a pothole on the ORR service road"
            placeholderTextColor={colors.text.secondary}
            multiline
            maxLength={1000}
          />
          <Text style={styles.counter}>{description.trim().length}/1000</Text>

          <Text style={[styles.label, { marginTop: spacing.sm }]}>
            Photos ({photos.length}/{MAX_PHOTOS})
          </Text>
          <Text style={styles.photoHint}>
            Clear photos of the damaged part speed the inspection up considerably.
          </Text>

          <View style={styles.photoRow}>
            {photos.map((p, i) => (
              <View key={p.uri} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <Pressable
                  style={styles.thumbRemove}
                  onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  hitSlop={6}
                  accessibilityLabel={`Remove photo ${i + 1}`}
                >
                  <Ionicons name="close" size={12} color={colors.common.white} />
                </Pressable>
              </View>
            ))}

            {photos.length < MAX_PHOTOS && (
              <>
                <Pressable style={styles.addPhoto} onPress={() => addPhoto(true)}>
                  <Ionicons name="camera-outline" size={20} color={colors.brand.primary} />
                  <Text style={styles.addPhotoText}>Camera</Text>
                </Pressable>
                <Pressable style={styles.addPhoto} onPress={() => addPhoto(false)}>
                  <Ionicons name="image-outline" size={20} color={colors.brand.primary} />
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </Pressable>
              </>
            )}
          </View>

          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.common.white} />
            ) : (
              <Text style={styles.submitText}>Submit report</Text>
            )}
          </Pressable>
        </NeoSurface>

        {/* An unsafe bike is a call, not a form. */}
        {severity === 'MAJOR' && (
          <Pressable style={styles.urgentCard} onPress={() => navigation.navigate('Support')}>
            <Ionicons name="call" size={18} color={colors.status.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.urgentTitle}>Unsafe to ride?</Text>
              <Text style={styles.urgentSub}>
                Stop riding and call the 24/7 roadside helpline instead of waiting for this report.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
          </Pressable>
        )}
      </ScrollView>

      <ThemedModal
        visible={!!success}
        title="Report submitted"
        message={success ?? ''}
        icon="checkmark-circle-outline"
        confirmLabel="Done"
        onConfirm={() => {
          setSuccess(null);
          navigation.goBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    paddingTop: 56,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: spacing.md },
  headerTitle: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.text.primary },

  scroll: { padding: screenPadding, paddingBottom: spacing.xxl },

  reassure: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.brand.mintSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reassureText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.primary,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.errorTint,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 12.5,
    color: colors.status.error,
  },

  card: { padding: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface.card },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  severityList: { gap: spacing.sm },
  severity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[50],
    borderWidth: 1.5,
    borderColor: colors.common.transparent,
  },
  severityOn: {
    backgroundColor: colors.brand.mintSoft,
    borderColor: colors.brand.primary,
  },
  severityLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text.primary,
  },
  severityLabelOn: { color: colors.brand.dark },
  severityHint: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },

  textArea: {
    minHeight: 96,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },
  counter: {
    fontFamily: fontFamily.regular,
    fontSize: 10.5,
    color: colors.text.secondary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },

  photoHint: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: radius.sm,
    backgroundColor: colors.neutral[100],
  },
  thumbRemove: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 68,
    height: 68,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.mintSoft,
    borderWidth: 1,
    borderColor: colors.brand.mintStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: colors.brand.dark,
    marginTop: 2,
  },

  submitBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitBtnDisabled: { backgroundColor: colors.state.disabledMid },
  submitText: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.common.white },

  urgentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.errorTint,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  urgentTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.status.error,
  },
  urgentSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.text.primary,
    marginTop: 1,
  },
});
