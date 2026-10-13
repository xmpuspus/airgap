/** Segmented control that lets the user pick offline only, prefer offline, or prefer online answers. */

import React, {useEffect, useRef, useState} from 'react';
import {Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, RADIUS, SPACING, TIMING, TYPOGRAPHY} from '../../constants/theme';
import {getMode, setUserMode, getConfigMode} from '../../services/llmRouter';
import type {UserMode} from '../../services/llmRouter';
import {t} from '../../utils/i18n';

const SEGMENTS: {value: UserMode; labelKey: string; fallback: string}[] = [
  {value: 'offline-only', labelKey: 'llmMode.offlineOnly', fallback: 'Offline only'},
  {value: 'prefer-offline', labelKey: 'llmMode.preferOffline', fallback: 'Prefer offline'},
  {value: 'prefer-online', labelKey: 'llmMode.preferOnline', fallback: 'Prefer online'},
];

export function LLMModeControl() {
  // Use the operator's config directly (not the resolved getMode()) so that
  // a stale user override from before a demo flip doesn't hide the banner.
  const operatorMode = getConfigMode();
  const isDemo = operatorMode === 'demo';
  const initialUserMode: UserMode = isDemo ? 'prefer-offline' : (getMode() as UserMode);
  const [active, setActive] = useState<UserMode>(() => initialUserMode);
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbX = useRef(new Animated.Value(0)).current;
  const segmentWidth = trackWidth / SEGMENTS.length;

  useEffect(() => {
    const idx = SEGMENTS.findIndex(s => s.value === active);
    Animated.timing(thumbX, {
      toValue: idx * segmentWidth,
      duration: TIMING.fast,
      useNativeDriver: true,
    }).start();
  }, [active, segmentWidth, thumbX]);

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const handlePress = (mode: UserMode) => {
    setActive(mode);
    // If the user picks the config default, clear the override so future
    // operator changes propagate.
    if (mode === getConfigMode()) {
      setUserMode(null);
    } else {
      setUserMode(mode);
    }
  };

  if (isDemo) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.demoNotice}>
          <Text style={styles.demoNoticeLabel}>Demo mode</Text>
          <Text style={styles.demoNoticeBody}>
            Your organization sets how answers are made in demo mode.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.track} onLayout={onLayout}>
        {trackWidth > 0 && (
          <Animated.View
            style={[
              styles.thumb,
              {
                width: segmentWidth - 4,
                transform: [{translateX: Animated.add(thumbX, new Animated.Value(2))}],
              },
            ]}
          />
        )}
        {SEGMENTS.map(seg => {
          const isActive = seg.value === active;
          return (
            <Pressable
              key={seg.value}
              onPress={() => handlePress(seg.value)}
              accessibilityRole="button"
              accessibilityState={{selected: isActive}}
              accessibilityLabel={t(seg.labelKey, seg.fallback)}
              style={styles.segment}
              hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
              <Text
                style={[styles.segmentLabel, isActive ? styles.segmentLabelActive : null]}
                numberOfLines={1}>
                {t(seg.labelKey, seg.fallback)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>
        {t(
          'llmMode.helper',
          'Offline modes never call out to the cloud. Prefer-offline falls back to cloud only when the local model is unavailable.',
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border + '50',
    padding: 2,
    height: 40,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  segmentLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  helper: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  demoNotice: {
    backgroundColor: COLORS.botBubble,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  demoNoticeLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  demoNoticeBody: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
});
