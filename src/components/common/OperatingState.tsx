import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {Mode} from '../../services/llmRouter';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';

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
  return (
    <View style={styles.container} accessibilityRole="summary">
      <View style={[styles.badge, styles[view.tone]]}>
        <Text style={styles.badgeText}>{view.label.toUpperCase()}</Text>
      </View>
      <Text style={styles.detail} numberOfLines={2}>
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
  badge: {
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.md,
  },
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
});
