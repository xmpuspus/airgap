/**
 * SyncSectionCard — Settings screen surface for the KB sync pipeline.
 *
 * Shows the current bundle source (compiled-in vs downloaded), version,
 * last sync time, freshness band, and last error if any. Provides a
 * "Sync now" button that calls syncService.syncKnowledge directly.
 *
 * Subscribes to onSync so the rows update immediately after a sync
 * completes (instead of waiting for the next 30s poll on StalenessChip).
 */

import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY} from '../../constants/theme';
import {
  getKbSource,
  getStalenessInfo,
  onSync,
  syncKnowledge,
} from '../../services/syncService';
import {t} from '../../utils/i18n';

function bandLabel(band: string): string {
  switch (band) {
    case 'fresh':
      return t('staleness.synced', 'Synced');
    case 'stale':
      return t('staleness.bandStale', 'Stale');
    case 'very_stale':
      return t('staleness.outdated', 'Outdated');
    default:
      return t('staleness.notSynced', 'Not synced');
  }
}

function bandColor(band: string): string {
  switch (band) {
    case 'fresh':
      return COLORS.success ?? '#059669';
    case 'stale':
      return COLORS.warning ?? '#D97706';
    case 'very_stale':
      return COLORS.error ?? '#DC2626';
    default:
      return COLORS.offline ?? '#94A3B8';
  }
}

function Row({label, value, valueColor}: {label: string; value: string; valueColor?: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, valueColor ? {color: valueColor} : null]}
        numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function SyncSectionCard() {
  const [info, setInfo] = useState(() => getStalenessInfo());
  const [source, setSource] = useState(() => getKbSource());
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    setInfo(getStalenessInfo());
    setSource(getKbSource());
  }, []);

  useEffect(() => {
    const unsub = onSync(() => {
      refresh();
      setSyncing(false);
    });
    return unsub;
  }, [refresh]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await syncKnowledge();
    } finally {
      setSyncing(false);
      refresh();
    }
  };

  const versionStr = source.bundleVersion ?? t('sync.noBundle', 'Built-in');
  const lastSyncStr = info.lastSyncAt
    ? new Date(info.lastSyncAt).toLocaleString()
    : t('sync.never', 'Never');
  const sourceStr =
    source.source === 'bundle'
      ? t('sync.sourceBundle', 'Downloaded bundle')
      : t('sync.sourceCompiled', 'Built-in');
  const band = info.band;
  const bandStr = bandLabel(band);
  const bandHex = bandColor(band);

  return (
    <View style={styles.card}>
      <Row label={t('sync.kbVersion', 'KB version')} value={versionStr} />
      <View style={styles.divider} />
      <Row label={t('sync.lastSync', 'Last sync')} value={lastSyncStr} />
      <View style={styles.divider} />
      <Row label={t('sync.source', 'Source')} value={sourceStr} />
      <View style={styles.divider} />
      <Row label={t('sync.status', 'Status')} value={bandStr} valueColor={bandHex} />
      {info.lastError ? (
        <>
          <View style={styles.divider} />
          <Row
            label={t('sync.lastError', 'Last error')}
            value={info.lastError}
            valueColor={COLORS.error}
          />
        </>
      ) : null}
      <View style={styles.divider} />
      <Pressable
        onPress={handleSyncNow}
        disabled={syncing}
        style={({pressed}) => [styles.actionRow, pressed && styles.actionRowPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('sync.syncNow', 'Sync knowledge base now')}>
        {syncing ? (
          <View style={styles.actionInner}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={[styles.actionText, {marginLeft: SPACING.sm}]}>
              {t('sync.syncing', 'Syncing…')}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.actionText}>{t('sync.syncNow', 'Sync now')}</Text>
            <View style={styles.chevron}>
              <View style={styles.chevronTop} />
              <View style={styles.chevronBottom} />
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.sm,
    borderWidth: 1,
    borderColor: COLORS.border + '40',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md + 3,
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
  },
  label: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flex: 1,
  },
  value: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.lg,
  },
  actionRow: {
    paddingVertical: SPACING.md + 3,
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionRowPressed: {
    opacity: 0.6,
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '600',
  },
  chevron: {
    width: 8,
    height: 14,
    justifyContent: 'center',
    opacity: 0.5,
  },
  chevronTop: {
    width: 8,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    transform: [{rotate: '45deg'}, {translateY: 2}],
  },
  chevronBottom: {
    width: 8,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    transform: [{rotate: '-45deg'}, {translateY: -2}],
  },
});
