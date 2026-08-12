import React from 'react';
import {View, Text, StyleSheet, useWindowDimensions} from 'react-native';
import type {Mode} from '../../services/llmRouter';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';
import {getOperatingStateLayout} from '../../utils/responsiveLayout';

type Tone = 'neutral' | 'ready' | 'warning';

export interface OperatingStateInput {
  mode: Mode;
  isOnline: boolean;
  localReady?: boolean;
  cloudReady?: boolean;
}

export function getOperatingStateView(input: OperatingStateInput): {
  label: 'Demo' | 'Local' | 'Cloud' | 'Offline';
  detail: string;
  tone: Tone;
} {
  if (input.mode === 'demo') {
    return {
      label: 'Demo',
      detail: 'Built-in sample answers. No network or model download.',
      tone: 'neutral',
    };
  }
  if (!input.isOnline && !input.localReady) {
    return {
      label: 'Offline',
      detail: 'Local knowledge is ready. Online actions wait in Outbox.',
      tone: 'warning',
    };
  }
  if (input.mode === 'prefer-online' && input.isOnline && input.cloudReady) {
    return {
      label: 'Cloud',
      detail: 'Answers may use the set-up cloud service.',
      tone: 'ready',
    };
  }
  return {
    label: 'Local',
    detail: 'Answers use local knowledge and the on-device model.',
    tone: 'ready',
  };
}

export function OperatingState(props: OperatingStateInput) {
  const view = getOperatingStateView(props);
  const {fontScale} = useWindowDimensions();
  const stacked = getOperatingStateLayout(fontScale) === 'stack';
  return (
    <View
      style={[styles.container, stacked && styles.containerStacked]}
      accessibilityRole="summary">
      <View style={[styles.badge, stacked && styles.badgeStacked, styles[view.tone]]}>
        <Text style={styles.badgeText}>{view.label.toUpperCase()}</Text>
      </View>
      <Text
        style={[styles.detail, stacked && styles.detailStacked]}
        numberOfLines={stacked ? undefined : 2}>
        {view.detail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  containerStacked: {alignItems: 'flex-start', flexDirection: 'column'},
  badge: {
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.md,
  },
  badgeStacked: {marginRight: 0, marginBottom: SPACING.xs},
  neutral: {backgroundColor: '#0B1F33'},
  ready: {backgroundColor: '#0E7490'},
  warning: {backgroundColor: '#C2410C'},
  badgeText: {
    ...TYPOGRAPHY.micro,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  detail: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    flex: 1,
  },
  detailStacked: {flex: 0, width: '100%'},
});
