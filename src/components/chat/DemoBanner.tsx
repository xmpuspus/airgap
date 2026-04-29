import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {COLORS, RADIUS, SPACING, TYPOGRAPHY} from '../../constants/theme';

// One-line banner above the message list when llm.mode === 'demo'.
export function DemoBanner() {
  return (
    <View
      style={styles.container}
      accessibilityLabel="Demo mode. Replies are formatted directly from the knowledge base, not from on-device LLM inference.">
      <View style={styles.dot} />
      <Text style={styles.label} numberOfLines={1}>
        Demo mode
      </Text>
      <Text style={styles.detail} numberOfLines={1}>
        local KB replies, no model download
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.botBubble,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.warning,
    marginRight: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '700',
    marginRight: SPACING.sm,
  },
  detail: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    flexShrink: 1,
  },
});
