import React, {useEffect, useRef, useState} from 'react';
import {Animated, View, Text, StyleSheet} from 'react-native';
import {COLORS, SPACING, TYPOGRAPHY, TIMING} from '../../constants/theme';

interface StatusBannerProps {
  isOnline: boolean;
}

const RECONNECT_DISPLAY_MS = 3000;

function WifiOffIcon() {
  return (
    <View style={[styles.iconCircle, {backgroundColor: 'rgba(255,255,255,0.18)'}]}>
      <View style={styles.wifiSlash} />
      <View style={styles.wifiDot} />
    </View>
  );
}

function CheckIcon() {
  return (
    <View style={[styles.iconCircle, {backgroundColor: 'rgba(255,255,255,0.18)'}]}>
      <View style={styles.checkMark} />
    </View>
  );
}

export function StatusBanner({isOnline}: StatusBannerProps) {
  const heightAnim = useRef(new Animated.Value(0)).current;
  const [showReconnect, setShowReconnect] = useState(false);
  const wasOffline = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowReconnect(false);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.spring(heightAnim, {
        toValue: 1,
        useNativeDriver: false,
        ...TIMING.springSnappy,
      }).start();
    } else if (wasOffline.current) {
      wasOffline.current = false;
      setShowReconnect(true);
      hideTimer.current = setTimeout(() => {
        setShowReconnect(false);
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: TIMING.normal,
          useNativeDriver: false,
        }).start();
      }, RECONNECT_DISPLAY_MS);
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isOnline, heightAnim]);

  const shouldShow = !isOnline || showReconnect;
  if (!shouldShow && !wasOffline.current) return null;

  const backgroundColor = showReconnect ? COLORS.success : COLORS.warning;
  const message = showReconnect
    ? 'Back online'
    : 'Offline mode \u2014 AI and search still work';

  const bannerHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 40],
  });

  return (
    <Animated.View
      style={[styles.container, {height: bannerHeight, backgroundColor}]}
      accessibilityLabel={message}
      accessibilityRole="alert">
      <View style={styles.content}>
        {showReconnect ? <CheckIcon /> : <WifiOffIcon />}
        <Text style={styles.text} numberOfLines={1}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    paddingHorizontal: SPACING.lg,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiSlash: {
    width: 10,
    height: 2,
    backgroundColor: COLORS.surface,
    borderRadius: 1,
    transform: [{rotate: '45deg'}],
  },
  wifiDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surface,
    bottom: 5,
  },
  checkMark: {
    width: 9,
    height: 5,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.surface,
    transform: [{rotate: '-45deg'}],
    marginTop: -2,
  },
  text: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.surface,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
