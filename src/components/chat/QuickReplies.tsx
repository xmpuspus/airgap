import React, {useEffect, useRef} from 'react';
import {
  ScrollView,
  Pressable,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY, TIMING} from '../../constants/theme';
import type {QuickReply} from '../../types/chat';

interface QuickRepliesProps {
  replies: QuickReply[];
  onPress: (reply: QuickReply) => void;
}

function Chip({
  reply,
  onPress,
  delay,
}: {
  reply: QuickReply;
  onPress: () => void;
  delay: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: TIMING.fast,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          ...TIMING.springSnappy,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay, fadeAnim, slideAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      ...TIMING.springSnappy,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...TIMING.springSnappy,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{translateY: slideAnim}, {scale: scaleAnim}],
      }}>
      <Pressable
        style={styles.chip}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={reply.title}
        accessibilityRole="button">
        <Text style={styles.chipText} numberOfLines={1}>
          {reply.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function QuickReplies({replies, onPress}: QuickRepliesProps) {
  if (!replies.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      style={styles.container}>
      {replies.map((reply, index) => (
        <Chip
          key={reply.value}
          reply={reply}
          onPress={() => onPress(reply)}
          delay={index * 40}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.sm + 2,
  },
  scroll: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  chip: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: COLORS.primary + '22',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.primary + '08',
  },
  chipText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
