import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {DownloadProgress} from '../components/onboarding/DownloadProgress';
import {useModelDownload} from '../hooks/useModelDownload';
import {COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, TIMING} from '../constants/theme';
import {config, brand, onboarding, interpolate} from '../config/loader';
import {t} from '../utils/i18n';

type RootStackParamList = {
  Chat: undefined;
  Settings: undefined;
  Onboarding: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'> & {
  onComplete?: () => void;
};

const ONBOARDING_FEATURES = onboarding?.features ?? [];
const ONBOARDING_TITLE = interpolate(
  onboarding?.title ?? 'Welcome to {{botName}}',
  config,
);
const ONBOARDING_SUBTITLE = interpolate(
  onboarding?.subtitle ?? '{{tagline}}',
  config,
);

// "How this works" capability bullets — operator-overridable via
// onboarding.extraFeatures. Defaults explain the three pillars of the
// product so a cold reviewer understands sync + hybrid LLM + safety
// before they even open the chat.
const EXTRA_FEATURES: string[] =
  (onboarding as unknown as {extraFeatures?: string[]})?.extraFeatures ?? [
    'Runs on-device — your conversations stay on your phone',
    'Syncs the knowledge base from the cloud when you are online',
    'Falls back to a cloud model only if you opt in',
  ];

const FEATURE_ICONS = [
  {shape: 'star', color: '#D97706'},
  {shape: 'bolt', color: '#DC2626'},
  {shape: 'pin', color: '#059669'},
  {shape: 'globe', color: '#2563EB'},
  {shape: 'card', color: '#7C3AED'},
  {shape: 'list', color: '#0891B2'},
];

function FeatureGlyph({shape, color}: {shape: string; color: string}) {
  switch (shape) {
    case 'star':
      return (
        <View style={glyphStyles.container}>
          <View style={[glyphStyles.diamond, {backgroundColor: color}]} />
          <View style={[glyphStyles.diamondH, {backgroundColor: color}]} />
        </View>
      );
    case 'bolt':
      return (
        <View style={glyphStyles.container}>
          <View style={[glyphStyles.boltTop, {backgroundColor: color}]} />
          <View style={[glyphStyles.boltBottom, {backgroundColor: color}]} />
        </View>
      );
    case 'pin':
      return (
        <View style={glyphStyles.container}>
          <View style={[glyphStyles.pinHead, {borderColor: color}]} />
          <View style={[glyphStyles.pinNeedle, {backgroundColor: color}]} />
        </View>
      );
    case 'globe':
      return (
        <View style={glyphStyles.container}>
          <View style={[glyphStyles.globeRing, {borderColor: color}]} />
          <View style={[glyphStyles.globeLine, {backgroundColor: color}]} />
        </View>
      );
    case 'card':
      return (
        <View style={glyphStyles.container}>
          <View style={[glyphStyles.cardBody, {borderColor: color}]}>
            <View style={[glyphStyles.cardStripe, {backgroundColor: color}]} />
          </View>
        </View>
      );
    case 'list':
    default:
      return (
        <View style={glyphStyles.container}>
          <View style={[glyphStyles.listLine, {backgroundColor: color}]} />
          <View style={[glyphStyles.listLineShort, {backgroundColor: color}]} />
          <View style={[glyphStyles.listLine, {backgroundColor: color}]} />
        </View>
      );
  }
}

const glyphStyles = StyleSheet.create({
  container: {width: 16, height: 16, alignItems: 'center', justifyContent: 'center'},
  diamond: {width: 10, height: 10, borderRadius: 2, transform: [{rotate: '45deg'}]},
  diamondH: {position: 'absolute', width: 6, height: 6, borderRadius: 1, transform: [{rotate: '45deg'}], opacity: 0.5},
  boltTop: {width: 8, height: 4, borderTopLeftRadius: 2, borderTopRightRadius: 2, marginBottom: 1, transform: [{skewX: '-15deg'}]},
  boltBottom: {width: 8, height: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, transform: [{skewX: '15deg'}]},
  pinHead: {width: 10, height: 10, borderRadius: 5, borderWidth: 2},
  pinNeedle: {width: 2, height: 4, borderRadius: 1, marginTop: -1},
  globeRing: {width: 12, height: 12, borderRadius: 6, borderWidth: 1.5},
  globeLine: {position: 'absolute', width: 12, height: 1.5, borderRadius: 1},
  cardBody: {width: 14, height: 10, borderRadius: 2, borderWidth: 1.5},
  cardStripe: {width: 8, height: 2, borderRadius: 1, marginTop: 2, marginLeft: 1},
  listLine: {width: 12, height: 2, borderRadius: 1, marginVertical: 1},
  listLineShort: {width: 8, height: 2, borderRadius: 1, marginVertical: 1, alignSelf: 'flex-start'},
});

export function OnboardingScreen({navigation, onComplete}: Props) {
  const insets = useSafeAreaInsets();
  const {progress, isDownloading, isDownloaded, modelSizeMB, startDownload} =
    useModelDownload();

  const logoScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(24)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(18)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaSlide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(logoScale, {
        toValue: 1,
        ...TIMING.springGentle,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: TIMING.slow,
          useNativeDriver: true,
        }),
        Animated.spring(titleSlide, {
          toValue: 0,
          ...TIMING.spring,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: TIMING.normal,
          useNativeDriver: true,
        }),
        Animated.spring(contentSlide, {
          toValue: 0,
          ...TIMING.spring,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: TIMING.normal,
          useNativeDriver: true,
        }),
        Animated.spring(ctaSlide, {
          toValue: 0,
          ...TIMING.spring,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [logoScale, titleOpacity, titleSlide, contentOpacity, contentSlide, ctaOpacity, ctaSlide]);

  const goToChat = () => {
    onComplete?.();
    navigation.replace('Chat');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, {paddingTop: insets.top + SPACING.xl}]}
      bounces={false}
      showsVerticalScrollIndicator={false}>
      {/* Background layers */}
      <View style={styles.bgGradientTop} />
      <View style={styles.bgGradientMid} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.brandSection,
          {transform: [{scale: logoScale}]},
        ]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/airgap-shield.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View
        style={{
          opacity: titleOpacity,
          transform: [{translateY: titleSlide}],
        }}>
        <Text style={styles.title}>{ONBOARDING_TITLE}</Text>
        <Text style={styles.subtitle}>{ONBOARDING_SUBTITLE}</Text>
      </Animated.View>

      {/* How this works — capability bullets */}
      <Animated.View
        style={[
          styles.capabilityCard,
          {
            opacity: contentOpacity,
            transform: [{translateY: contentSlide}],
          },
        ]}>
        <Text style={styles.featureHeader}>{t('howThisWorksHeader', 'How this works')}</Text>
        {EXTRA_FEATURES.map((bullet, idx) => (
          <View key={idx} style={styles.capabilityRow}>
            <View style={styles.capabilityDot} />
            <Text style={styles.capabilityText}>{bullet}</Text>
          </View>
        ))}
        <View style={styles.capabilityDivider} />
        <Text style={styles.languageNotice}>
          {t(
            'languageNotice',
            'Knowledge base is currently English-only. Operator translations welcome.',
          )}
        </Text>
      </Animated.View>

      {/* Feature list */}
      <Animated.View
        style={[
          styles.featureCard,
          {
            opacity: contentOpacity,
            transform: [{translateY: contentSlide}],
          },
        ]}>
        <Text style={styles.featureHeader}>{t('featureHeader', 'I can help you with')}</Text>
        {ONBOARDING_FEATURES.map((feature, index) => {
          const icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
          return (
            <View key={index} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIcon,
                  {backgroundColor: icon.color + '10'},
                ]}>
                <FeatureGlyph shape={icon.shape} color={icon.color} />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          );
        })}
      </Animated.View>

      {/* CTA section */}
      <Animated.View
        style={[
          styles.bottomSection,
          {
            paddingBottom: insets.bottom + SPACING.xl,
            opacity: ctaOpacity,
            transform: [{translateY: ctaSlide}],
          },
        ]}>
        <DownloadProgress
          onSkip={goToChat}
          onComplete={goToChat}
          progress={progress}
          isDownloading={isDownloading}
          isDownloaded={isDownloaded}
          modelSizeMB={modelSizeMB}
          startDownload={startDownload}
        />

        {!isDownloading && (
          <TouchableOpacity
            style={[
              styles.getStartedButton,
              isDownloaded && styles.getStartedButtonReady,
            ]}
            onPress={goToChat}
            activeOpacity={0.8}
            accessibilityLabel={isDownloaded ? t('startChatting', 'Start Chatting') : t('continueWithoutAI', 'Continue Without AI')}
            accessibilityRole="button">
            <Text style={styles.getStartedText}>
              {isDownloaded ? t('startChatting', 'Start Chatting') : t('continueWithoutAI', 'Continue Without AI')}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.poweredBy}>Powered by {brand.name}</Text>
      </Animated.View>
    </ScrollView>
  );
}

export default OnboardingScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContent: {
    flexGrow: 1,
  },
  bgGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: COLORS.primary,
    opacity: 0.04,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  bgGradientMid: {
    position: 'absolute',
    top: 40,
    left: 30,
    right: 30,
    height: 240,
    backgroundColor: COLORS.primary,
    opacity: 0.02,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border + '60',
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  title: {
    ...TYPOGRAPHY.display,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING['2xl'],
    marginBottom: SPACING.xl,
  },
  featureCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    ...SHADOWS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border + '60',
    marginBottom: SPACING.md,
  },
  capabilityCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: COLORS.border + '30',
    borderRightColor: COLORS.border + '30',
    borderBottomColor: COLORS.border + '30',
    marginBottom: SPACING.md,
  },
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  capabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 7,
    marginRight: SPACING.md,
  },
  capabilityText: {
    flex: 1,
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text,
  },
  capabilityDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm + 2,
  },
  languageNotice: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  featureHeader: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm + 2,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  featureIconGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text,
  },
  bottomSection: {
    marginTop: 'auto',
    paddingHorizontal: SPACING.xl,
  },
  getStartedButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.md,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
  },
  getStartedButtonReady: {
    backgroundColor: COLORS.success,
    shadowColor: COLORS.success,
  },
  getStartedText: {
    ...TYPOGRAPHY.title,
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  poweredBy: {
    textAlign: 'center',
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
    opacity: 0.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
