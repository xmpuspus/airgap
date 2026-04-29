import React, {useEffect, useRef, useCallback} from 'react';
import {View, Text, Image, StyleSheet, Animated} from 'react-native';
import {COLORS, SPACING, SHADOWS, TYPOGRAPHY, TIMING} from '../../constants/theme';
import {brand, quickReplies} from '../../config/loader';
import {t} from '../../utils/i18n';
import {QuickReplies} from './QuickReplies';
import type {QuickReply} from '../../types/chat';

const AVATAR_SIZE = 80;

// Feature summary pills shown below the greeting
const FEATURE_PILLS = [
  'Plans & Pricing',
  'Troubleshooting',
  'Store Locator',
];

interface Props {
  onQuickReply: (reply: QuickReply) => void;
}

export function EmptyState({onQuickReply}: Props) {
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0.08)).current;
  const avatarFade = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.8)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(16)).current;
  const pillsFade = useRef(new Animated.Value(0)).current;
  const pillsSlide = useRef(new Animated.Value(12)).current;
  const repliesFade = useRef(new Animated.Value(0)).current;
  const repliesSlide = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // Staggered entrance: avatar → text → pills → replies
    Animated.stagger(100, [
      Animated.parallel([
        Animated.spring(avatarScale, {
          toValue: 1,
          ...TIMING.springGentle,
          useNativeDriver: true,
        }),
        Animated.timing(avatarFade, {
          toValue: 1,
          duration: TIMING.normal,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textFade, {
          toValue: 1,
          duration: TIMING.normal,
          useNativeDriver: true,
        }),
        Animated.spring(textSlide, {
          toValue: 0,
          ...TIMING.spring,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(pillsFade, {
          toValue: 1,
          duration: TIMING.normal,
          useNativeDriver: true,
        }),
        Animated.spring(pillsSlide, {
          toValue: 0,
          ...TIMING.spring,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(repliesFade, {
          toValue: 1,
          duration: TIMING.normal,
          useNativeDriver: true,
        }),
        Animated.spring(repliesSlide, {
          toValue: 0,
          ...TIMING.spring,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Subtle breathing animation on avatar
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 0.97,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1.03,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 0.18,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 0.08,
          duration: 2500,
          useNativeDriver: true,
        }),
      ]),
    );
    breathe.start();
    ring.start();
    return () => {
      breathe.stop();
      ring.stop();
    };
  }, [
    breatheAnim, ringAnim, avatarFade, avatarScale,
    textFade, textSlide, pillsFade, pillsSlide, repliesFade, repliesSlide,
  ]);

  const handleQuickReply = useCallback(
    (reply: QuickReply) => {
      onQuickReply(reply);
    },
    [onQuickReply],
  );

  return (
    <View style={styles.container}>
      {/* Avatar with glow ring */}
      <Animated.View
        style={[
          styles.avatarSection,
          {
            opacity: avatarFade,
            transform: [{scale: avatarScale}],
          },
        ]}>
        <Animated.View style={[styles.glowRing, {opacity: ringAnim}]} />
        <Animated.View
          style={[
            styles.avatarWrapper,
            {transform: [{scale: breatheAnim}]},
          ]}>
          <Image
            source={require('../../../assets/images/airgap-avatar.png')}
            style={styles.avatar}
            resizeMode="cover"
          />
        </Animated.View>
      </Animated.View>

      {/* Greeting */}
      <Animated.View
        style={{
          opacity: textFade,
          transform: [{translateY: textSlide}],
        }}>
        <Text style={styles.greeting}>
          {t('emptyStateGreeting', `Hi, I'm ${brand.botName}`)}
        </Text>
        <Text style={styles.prompt}>
          {t('emptyStatePrompt', `Ask me anything about ${brand.name}`)}
        </Text>
      </Animated.View>

      {/* Feature summary pills */}
      <Animated.View
        style={[
          styles.pillsRow,
          {
            opacity: pillsFade,
            transform: [{translateY: pillsSlide}],
          },
        ]}>
        {FEATURE_PILLS.map(label => (
          <View key={label} style={styles.featurePill}>
            <Text style={styles.featurePillText}>{label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Quick replies */}
      {quickReplies.length > 0 && (
        <Animated.View
          style={[
            styles.repliesWrapper,
            {
              opacity: repliesFade,
              transform: [{translateY: repliesSlide}],
            },
          ]}>
          <QuickReplies replies={quickReplies} onPress={handleQuickReply} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: SPACING['3xl'],
    paddingBottom: SPACING.xl,
  },
  avatarSection: {
    width: AVATAR_SIZE + 28,
    height: AVATAR_SIZE + 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  glowRing: {
    position: 'absolute',
    width: AVATAR_SIZE + 28,
    height: AVATAR_SIZE + 28,
    borderRadius: (AVATAR_SIZE + 28) / 2,
    backgroundColor: COLORS.primary,
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
    ...SHADOWS.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  greeting: {
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  prompt: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  featurePill: {
    backgroundColor: COLORS.primary + '0A',
    borderWidth: 1,
    borderColor: COLORS.primary + '18',
    borderRadius: SPACING.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  featurePillText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '500',
  },
  repliesWrapper: {
    width: '100%',
  },
});
