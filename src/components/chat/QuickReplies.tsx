import React from 'react';
import {View, Pressable, Text, StyleSheet} from 'react-native';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';
import type {QuickReply} from '../../types/chat';

interface QuickRepliesProps {
  replies: QuickReply[];
  onPress: (reply: QuickReply) => void;
}

export function QuickReplies({replies, onPress}: QuickRepliesProps) {
  if (!replies.length) return null;
  return (
    <View style={styles.container} accessibilityLabel="Suggested actions">
      {replies.map(reply => (
        <Pressable
          key={reply.value}
          style={({pressed}) => [styles.chip, pressed && styles.pressed]}
          onPress={() => onPress(reply)}
          accessibilityLabel={reply.title}
          accessibilityRole="button">
          <Text style={styles.text}>{reply.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0E7490',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  pressed: {backgroundColor: '#E8F4F7', borderColor: '#155E75'},
  text: {...TYPOGRAPHY.bodySmall, color: '#0E7490', fontWeight: '700'},
});
