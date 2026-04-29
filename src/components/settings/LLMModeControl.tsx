/**
 * LLMModeControl — segmented control for the LLM routing mode. Persists
 * the user override in MMKV via llmRouter.setUserMode. Falls back to the
 * operator default in airgap.config.json when the user has not set an
 * override (the "Use config default" reset path).
 *
 * Three options:
 *  - Offline only   : never use cloud, even if available
 *  - Prefer offline : try local first, escalate to cloud only on failure
 *  - Prefer online  : try cloud first, fall back to local on failure
 *
 * Implementation: hand-rolled segmented control with absolute-positioned
 * thumb (no library). Animated.Value moves the thumb on selection change.
 */

import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  const initialUserMode: UserMode = isDemo
    ? 'prefer-offline'
    : (getMode() as UserMode);
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

  // Demo mode is operator-only. Hooks above still ran unconditionally;
  // we just render a read-only banner instead of the segmented control.
  if (isDemo) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.demoNotice}>
          <Text style={styles.demoNoticeLabel}>Demo mode</Text>
          <Text style={styles.demoNoticeBody}>
            Routing is fixed by the operator. Disable demo in
            airgap.config.json to expose offline and online options here.
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
                style={[
                  styles.segmentLabel,
                  isActive ? styles.segmentLabelActive : null,
                ]}
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
    backgroundColor: COLORS.inputBg ?? COLORS.surface,
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
    backgroundColor: COLORS.botBubble ?? '#F1F5F9',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border ?? '#E5E7EB',
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
