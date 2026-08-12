import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import type {QueueRecord} from '../../services/actionQueueTypes';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';

export function getActionReceiptView(record: QueueRecord) {
  const title = (record.toolName ?? record.type).replaceAll('_', ' ');
  const status = {
    pending: ['Pending', 'This action will run when the service is available.'],
    processing: ['Retrying', 'The service is processing this action.'],
    failed: ['Failed', 'The service did not accept this action.'],
    completed: ['Completed', 'The service completed this action.'],
  }[record.status];
  return {
    title,
    statusLabel: status[0],
    detail: status[1],
    actions: record.status === 'failed' ? ['Retry', 'Remove'] : [],
  };
}

export function ActionReceipt({
  record,
  onRetry,
  onRemove,
}: {
  record: QueueRecord;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const view = getActionReceiptView(record);
  const failed = record.status === 'failed';
  return (
    <View style={[styles.card, failed && styles.failed]}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>{view.title}</Text>
        <Text style={[styles.status, failed && styles.failedStatus]}>{view.statusLabel}</Text>
      </View>
      <Text style={styles.detail}>{view.detail}</Text>
      {failed && (
        <View style={styles.actions}>
          <Pressable
            style={styles.retry}
            onPress={() => onRetry?.(record.id)}
            accessibilityLabel="Retry action"
            accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
          <Pressable
            style={styles.remove}
            onPress={() => onRemove?.(record.id)}
            accessibilityLabel="Remove action"
            accessibilityRole="button">
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  failed: {borderLeftWidth: 4, borderLeftColor: '#C2410C'},
  headingRow: {flexDirection: 'row', justifyContent: 'space-between'},
  title: {...TYPOGRAPHY.caption, color: '#0B1F33', fontWeight: '700'},
  status: {...TYPOGRAPHY.micro, color: '#0E7490', textTransform: 'uppercase'},
  failedStatus: {color: '#C2410C'},
  detail: {...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: 4},
  actions: {flexDirection: 'row', marginTop: SPACING.md, gap: SPACING.sm},
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: '#0E7490',
  },
  retryText: {...TYPOGRAPHY.caption, color: '#FFFFFF', fontWeight: '700'},
  remove: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  removeText: {...TYPOGRAPHY.caption, color: '#C2410C', fontWeight: '700'},
});
