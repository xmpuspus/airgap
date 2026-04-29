/**
 * StalenessChip — a small pressable row rendered in the chat screen header.
 * Reads syncService.getStalenessInfo() on mount and every 30 seconds, and
 * surfaces the current KB freshness band so a cold reviewer can see that
 * the app is syncing (or needs to sync). Tapping opens an Alert with
 * version + last-sync info and a "Sync now" button.
 *
 * Visual rules:
 *  - fresh (<24h)       : success dot + "Synced"
 *  - stale (24h-7d)     : warning dot + "Updated Xd ago"
 *  - very_stale (>7d)   : error dot   + "Outdated"
 *  - never              : offline dot + "Not synced"
 *  - syncing            : primary dot with a pulse animation
 *
 * No emoji — the dot is a 8px View circle. Matches the rest of the
 * geometric icon language in the app.
 */

import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import {COLORS, SPACING, TYPOGRAPHY} from '../../constants/theme';
import {
  getStalenessInfo,
  getKbSource,
  syncKnowledge,
  onSync,
} from '../../services/syncService';
import {t} from '../../utils/i18n';

type Band = 'fresh' | 'stale' | 'very_stale' | 'never';

function bandColor(band: Band): string {
  switch (band) {
    case 'fresh':
      return COLORS.success ?? '#059669';
    case 'stale':
      return COLORS.warning ?? '#D97706';
    case 'very_stale':
      return COLORS.error ?? '#DC2626';
    case 'never':
    default:
      return COLORS.offline ?? '#94A3B8';
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
  const dotColor = bandColor(band);
  const label = useMemo(() => bandLabel(band, info.ageMs), [band, info.ageMs]);

  const handlePress = useCallback(() => {
    const {source, bundleVersion} = getKbSource();
    const lines: string[] = [];
    lines.push(
      t('staleness.status', 'Status') + ': ' + label,
    );
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
      lines.push(
        t('staleness.lastError', 'Last error') + ': ' + info.lastError,
      );
    }

    Alert.alert(
      t('staleness.title', 'Knowledge base'),
      lines.join('\n'),
      [
        {text: t('common.close', 'Close'), style: 'cancel'},
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
      ],
    );
  }, [info.lastSyncAt, info.lastError, label, refresh]);

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
