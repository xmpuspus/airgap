/**
 * Header chip that shows record freshness, polled every 30 seconds, and opens a status alert.
 * The dot color follows the freshness band when an update server is set up. It pulses while syncing.
 */

import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {Alert, Animated, Pressable, StyleSheet, Text} from 'react-native';
import {COLORS, SPACING, TYPOGRAPHY} from '../../constants/theme';
import {
  getStalenessInfo,
  getKbSource,
  isSyncConfigured,
  syncKnowledge,
  onSync,
} from '../../services/syncService';
import {t} from '../../utils/i18n';
import {recordsStatusLabel} from '../../utils/appChrome';

// Built-in records are neither fresh nor stale, so their dot is neutral.
const BUILT_IN_DOT = 'rgba(255,255,255,0.7)';

type Band = 'fresh' | 'stale' | 'very_stale' | 'never';

function bandColor(band: Band): string {
  switch (band) {
    case 'fresh':
      return COLORS.success;
    case 'stale':
      return COLORS.warning;
    case 'very_stale':
      return COLORS.error;
    case 'never':
    default:
      return COLORS.offline;
  }
}

function formatAge(ms: number | null): string {
  if (ms === null) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function bandLabel(band: Band, ageMs: number | null): string {
  switch (band) {
    case 'fresh':
      return t('staleness.synced', 'Synced');
    case 'stale': {
      const tpl = t('staleness.updatedAgo', 'Updated {{age}} ago');
      return tpl.replace('{{age}}', formatAge(ageMs));
    }
    case 'very_stale':
      return t('staleness.outdated', 'Outdated');
    case 'never':
    default:
      return t('staleness.notSynced', 'Not synced');
  }
}

const POLL_INTERVAL_MS = 30_000;

export function StalenessChip() {
  const [info, setInfo] = useState(() => getStalenessInfo());
  const [syncing, setSyncing] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const refresh = useCallback(() => {
    setInfo(getStalenessInfo());
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    const unsub = onSync(() => refresh());
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [refresh]);

  useEffect(() => {
    if (!syncing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1.45, duration: 500, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 1.0, duration: 500, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [syncing, pulse]);

  const band = info.band as Band;
  const syncConfigured = isSyncConfigured();
  const dotColor = syncConfigured ? bandColor(band) : BUILT_IN_DOT;
  const label = useMemo(
    () => recordsStatusLabel(syncConfigured, bandLabel(band, info.ageMs)),
    [syncConfigured, band, info.ageMs],
  );

  const handlePress = useCallback(() => {
    const {source, bundleVersion} = getKbSource();
    const lines: string[] = [];
    lines.push(t('staleness.status', 'Status') + ': ' + label);
    lines.push(
      t('staleness.source', 'Source') +
        ': ' +
        (source === 'bundle' ? 'Downloaded bundle' : 'Built-in'),
    );
    if (bundleVersion) {
      lines.push(t('staleness.version', 'Version') + ': ' + bundleVersion);
    }
    if (info.lastSyncAt) {
      lines.push(
        t('staleness.lastSyncedAt', 'Last synced') +
          ': ' +
          new Date(info.lastSyncAt).toLocaleString(),
      );
    }
    if (info.lastError) {
      lines.push(t('staleness.lastError', 'Last error') + ': ' + info.lastError);
    }

    // Without an update server, "Sync now" could only fail.
    const close = {text: t('common.close', 'Close'), style: 'cancel' as const};
    Alert.alert(
      t('staleness.title', 'Knowledge base'),
      lines.join('\n'),
      syncConfigured
        ? [
            close,
            {
              text: t('staleness.syncNow', 'Sync now'),
              onPress: async () => {
                setSyncing(true);
                try {
                  await syncKnowledge();
                } finally {
                  setSyncing(false);
                  refresh();
                }
              },
            },
          ]
        : [close],
    );
  }, [info.lastSyncAt, info.lastError, label, refresh, syncConfigured]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{top: 12, right: 12, bottom: 12, left: 12}}
      accessibilityRole="button"
      accessibilityLabel={t('staleness.a11y', 'Knowledge base status')}
      accessibilityHint={label}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
      <Animated.View
        style={[styles.dot, {backgroundColor: dotColor, transform: [{scale: pulse}]}]}
      />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING['2xs'] + 2,
    marginTop: 2,
    gap: 6,
  },
  rowPressed: {
    opacity: 0.6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textInverse,
    opacity: 0.85,
    letterSpacing: 0.3,
  },
});
