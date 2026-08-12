import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, SPACING, RADIUS, TYPOGRAPHY} from '../../constants/theme';
import {getInputToolbarLayout} from '../../utils/responsiveLayout';

interface InputToolbarProps {
  onSend: (text: string) => void;
}

export function InputToolbar({onSend}: InputToolbarProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const insets = useSafeAreaInsets();
  const {fontScale} = useWindowDimensions();
  const stacked = getInputToolbarLayout(fontScale) === 'stack';
  const canSend = text.trim().length > 0;

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }, [onSend, text]);

  return (
    <View
      style={[
        styles.container,
        stacked && styles.containerStacked,
        {paddingBottom: Math.max(insets.bottom, SPACING.sm)},
      ]}>
      <TextInput
        style={[styles.input, stacked && styles.inputStacked, isFocused && styles.inputFocused]}
        value={text}
        onChangeText={setText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Ask a support question"
        placeholderTextColor={COLORS.textSecondary}
        multiline
        maxLength={1000}
        accessibilityLabel="Support question"
      />
      <Pressable
        style={[styles.send, stacked && styles.sendStacked, !canSend && styles.sendDisabled]}
        onPress={handleSend}
        disabled={!canSend}
        accessibilityLabel="Send message"
        accessibilityRole="button"
        accessibilityState={{disabled: !canSend}}>
        <Text style={styles.sendText}>Send</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  containerStacked: {flexDirection: 'column', alignItems: 'stretch'},
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: '#F6F8FA',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    paddingBottom: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    ...TYPOGRAPHY.body,
    color: '#0B1F33',
  },
  inputStacked: {flex: 0, width: '100%'},
  inputFocused: {borderColor: '#0E7490', backgroundColor: '#FFFFFF'},
  send: {
    minWidth: 68,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: '#0E7490',
    paddingHorizontal: SPACING.md,
  },
  sendStacked: {width: '100%'},
  sendDisabled: {backgroundColor: '#94A3B8'},
  sendText: {...TYPOGRAPHY.caption, color: '#FFFFFF', fontWeight: '800'},
});
