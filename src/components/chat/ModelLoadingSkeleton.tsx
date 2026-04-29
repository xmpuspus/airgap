import React, {useEffect, useRef} from 'react';
import {View, Text, Animated, StyleSheet} from 'react-native';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';
import {brand} from '../../config/loader';
import {t} from '../../utils/i18n';

export function ModelLoadingSkeleton() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const barColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border ?? '#E2E8F0', COLORS.primary + '30'],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {t('loadingModel', `Loading ${brand.botName} AI model...`)}
      </Text>
      <Animated.View style={[styles.bar, {backgroundColor: barColor}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  text: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  bar: {
    height: 4,
    width: '60%',
    borderRadius: RADIUS.full,
  },
});
