import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SafetyGuide'>;

/**
 * Safety & helmet guide.
 *
 * The side drawer has always listed this item; until now tapping it just
 * closed the drawer. The content is genuinely static, so it lives here rather
 * than behind an endpoint.
 */

const HELMET_STEPS = [
  {
    title: 'Two fingers above the eyebrows',
    body: 'The rim should sit level, not tilted back. A helmet pushed back leaves your forehead exposed in exactly the fall it is meant to protect.',
  },
  {
    title: 'Straps form a V under each ear',
    body: 'Adjust the side sliders until the V sits just below the earlobe with no slack.',
  },
  {
    title: 'One finger under the chin strap',
    body: 'Snug enough that you can slide one finger in, not two. Open your mouth — you should feel the helmet pull down.',
  },
  {
    title: 'Shake test',
    body: 'Nod and shake your head. The helmet should move your skin with it, not slide independently.',
  },
];

const RIDE_RULES = [
  { icon: 'speedometer-outline' as const, text: 'Stay under the posted limit. Our bikes cap at 65 km/h — city roads rarely allow that.' },
  { icon: 'rainy-outline' as const, text: 'In rain, brake earlier and lean less. Painted road markings and metal covers turn slick first.' },
  { icon: 'battery-half-outline' as const, text: 'Swap before you hit 15%. Below that the motor limits power and you may not reach the next dock.' },
  { icon: 'phone-portrait-outline' as const, text: 'Mount the phone or pull over. Riding one-handed with a phone is the single most common cause of our damage reports.' },
  { icon: 'people-outline' as const, text: 'One rider, one pillion, both helmeted. Anything more voids the insurance on the rental.' },
];

const EMERGENCY = [
  { label: 'Ride For You helpline', detail: '24/7 roadside assistance', tel: '+918000000000' },
  { label: 'Police', detail: 'Accident or theft', tel: '100' },
  { label: 'Ambulance', detail: 'Medical emergency', tel: '108' },
];

export default function SafetyGuideScreen({ navigation }: Props) {
  const call = (tel: string) => Linking.openURL(`tel:${tel}`).catch(() => {});

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Safety & Helmet Guide</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroHalo}>
            <Ionicons name="shield-checkmark" size={26} color={colors.brand.primary} />
          </View>
          <Text style={styles.heroTitle}>Every ride is insured — if you ride it right</Text>
          <Text style={styles.heroSub}>
            Helmets on both heads, licence on you, and the bike used as intended. That is the
            whole of it.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Fitting your helmet</Text>
        <View style={styles.card}>
          {HELMET_STEPS.map((s, i) => (
            <View key={s.title} style={[styles.step, i === HELMET_STEPS.length - 1 && styles.stepLast]}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepBody}>{s.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>On the road</Text>
        <View style={styles.card}>
          {RIDE_RULES.map((r, i) => (
            <View key={r.text} style={[styles.rule, i === RIDE_RULES.length - 1 && styles.stepLast]}>
              <View style={styles.ruleIcon}>
                <Ionicons name={r.icon} size={16} color={colors.brand.primary} />
              </View>
              <Text style={styles.ruleText}>{r.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>If something goes wrong</Text>
        <View style={styles.card}>
          {EMERGENCY.map((e, i) => (
            <Pressable
              key={e.tel}
              style={[styles.emergency, i === EMERGENCY.length - 1 && styles.stepLast]}
              onPress={() => call(e.tel)}
              accessibilityRole="button"
              accessibilityLabel={`Call ${e.label}`}
            >
              <View style={styles.emergencyIcon}>
                <Ionicons name="call" size={15} color={colors.status.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyLabel}>{e.label}</Text>
                <Text style={styles.emergencyDetail}>{e.detail}</Text>
              </View>
              <Text style={styles.emergencyTel}>{e.tel}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.reportCard} onPress={() => navigation.navigate('ReportDamage')}>
          <Ionicons name="camera-outline" size={18} color={colors.brand.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Damaged the bike?</Text>
            <Text style={styles.reportSub}>Report it with photos — early reports are easier on everyone</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
        </Pressable>
      </ScrollView>
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

  hero: { alignItems: 'center', paddingBottom: spacing.md },
  heroHalo: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  heroSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },

  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadows.subtle,
  },

  step: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepLast: { borderBottomWidth: 0 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: fontFamily.bold, fontSize: 11.5, color: colors.brand.dark },
  stepTitle: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.text.primary },
  stepBody: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.secondary,
    marginTop: 2,
  },

  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ruleIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.primary,
  },

  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emergencyIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.status.errorTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyLabel: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.text.primary },
  emergencyDetail: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
  },
  emergencyTel: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.brand.primary },

  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...shadows.subtle,
  },
  reportTitle: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.text.primary },
  reportSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    marginTop: 1,
  },
});
