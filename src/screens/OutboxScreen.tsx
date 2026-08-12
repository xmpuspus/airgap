import React, {useEffect, useState} from 'react';
import {View, Text, FlatList, StyleSheet} from 'react-native';
import type {QueueRecord} from '../services/actionQueueTypes';
import {offlineQueue} from '../services/offlineQueue';
import {ActionReceipt} from '../components/chat/ActionReceipt';
import {COLORS, SPACING, TYPOGRAPHY} from '../constants/theme';

export function getOutboxView(records: QueueRecord[]) {
  return {
    title: 'Outbox',
    records: [...records].sort((left, right) => right.createdAt - left.createdAt),
  };
}

export function OutboxScreen() {
  const [records, setRecords] = useState(() => getOutboxView(offlineQueue.getQueue()).records);

  useEffect(() => offlineQueue.subscribe(next => setRecords(getOutboxView(next).records)), []);

  const retry = async (id: string) => {
    offlineQueue.retry(id);
    await offlineQueue.processQueue();
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.summary}>
        Pending and failed online actions stay here until they complete or you remove them.
      </Text>
      <FlatList
        data={records}
        keyExtractor={record => record.id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <ActionReceipt record={item} onRetry={retry} onRemove={id => offlineQueue.remove(id)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Outbox is clear</Text>
            <Text style={styles.emptyText}>No online action needs attention.</Text>
          </View>
        }
      />
    </View>
  );
}

export default OutboxScreen;

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6F8FA'},
  summary: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  list: {padding: SPACING.lg},
  empty: {alignItems: 'center', paddingVertical: SPACING['3xl']},
  emptyTitle: {...TYPOGRAPHY.title, color: '#0B1F33'},
  emptyText: {...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SPACING.sm},
});
