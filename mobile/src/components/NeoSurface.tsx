/**
 * NeoSurface.tsx
 * --------------
 * A soft "neumorphic" white surface — the puffy, raised look in the mockup.
 * Used for: the login card, the +91 pill, the Google button, the phone field.
 *
 *   variant="raised"  → floats above the page  (card, +91 pill, Google button)
 *   variant="inset"   → gently pressed in      (the phone-number text field)
 *
 * The actual shadow / border values live in theme/effects.ts (`neo`), so the
 * whole app's neumorphism is tuned from one place.
 *
 * Usage:
 *   <NeoSurface borderRadius={radius.card} style={{ padding: spacing.lg }}>
 *     ...card contents...
 *   </NeoSurface>
 */

import React from 'react';
import { View, ViewProps } from 'react-native';
import { neo, radius } from '../theme';

type NeoSurfaceProps = ViewProps & {
  /** card = the big floating panel · raised = pills/buttons · inset = inputs */
  variant?: 'card' | 'raised' | 'inset';
  borderRadius?: number;
};

export function NeoSurface({
  variant = 'raised',
  borderRadius = radius.lg,
  style,
  children,
  ...rest
}: NeoSurfaceProps) {
  return (
    <View style={[neo[variant], { borderRadius }, style]} {...rest}>
      {children}
    </View>
  );
}
