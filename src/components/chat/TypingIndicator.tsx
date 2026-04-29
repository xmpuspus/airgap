import React, {useEffect, useRef} from 'react';
import {View, Text, Image, Animated, StyleSheet} from 'react-native';
import {COLORS, SPACING, SHADOWS, TYPOGRAPHY, TIMING, BUBBLE_RADIUS} from '../../constants/theme';
import {brand} from '../../config/loader';

const AVATAR_SIZE = 32;
const DOT_SIZE = 7;
const DOT_COUNT = 3;
const ANIMATION_DURATION = 380;
const STAGGER_DELAY = 130;

export function TypingIndicator() {
  const dots = useRef(
    Array.from({length: DOT_COUNT}, () => new Animated.Value(0)),
  ).current;

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * STAGGER_DELAY),
          Animated.timing(dot, {
            toValue: 1,
            duration: ANIMATION_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: ANIMATION_DURATION,
            useNativeDriver: true,
          }),
          Animated.delay(
            (DOT_COUNT - 1 - index) * STAGGER_DELAY + ANIMATION_DURATION,
          ),
        ]),
      ),
    );

    const composite = Animated.parallel(animations);
    composite.start();

    return () => composite.stop();
  }, [dots]);

  useEffect(() => {
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: TIMING.normal,
      useNativeDriver: true,
    }).start();
  }, [pulseAnim]);

  // Use "standalone" bot radii for the typing bubble
  const radii = BUBBLE_RADIUS.bot.standalone;

  return (
    <Animated.View style={[styles.wrapper, {opacity: pulseAnim}]}>
      <View style={styles.avatar}>
        <Image
          source={require('../../../assets/images/airgap-avatar.png')}
          style={styles.avatarImage}
          resizeMode="cover"
        />
      </View>
      <View>
        <View
          style={[
            styles.bubbleContainer,
            {
              borderTopLeftRadius: radii.topLeft,
              borderTopRightRadius: radii.topRight,
              borderBottomLeftRadius: radii.bottomLeft,
              borderBottomRightRadius: radii.bottomRight,
            },
          ]}>
          <View style={styles.dotRow}>
            {dots.map((dot, index) => {
              const translateY = dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -4],
              });
              const scale = dot.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.15, 1],
              });
              const opacity = dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              });
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.dot,
                    {transform: [{translateY}, {scale}], opacity},
                  ]}
                />
              );
            })}
          </View>
        </View>
        <Text style={styles.label}>{brand.botName} is thinking...</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: SPACING.sm,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  bubbleContainer: {
    backgroundColor: COLORS.botBubble,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOWS.sm,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: COLORS.primary,
  },
  label: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginLeft: SPACING['2xs'],
    opacity: 0.6,
  },
});
