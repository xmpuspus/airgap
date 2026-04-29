import React, {useState, useCallback, useEffect, useRef} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, SPACING, RADIUS, TIMING} from '../../constants/theme';
import {brand} from '../../config/loader';

interface InputToolbarProps {
  onSend: (text: string) => void;
}

export function InputToolbar({onSend}: InputToolbarProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const insets = useSafeAreaInsets();
  const sendScale = useRef(new Animated.Value(0)).current;
  const sendRotate = useRef(new Animated.Value(0)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;
  const plusRotate = useRef(new Animated.Value(0)).current;

  const showSend = text.trim().length > 0;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(sendScale, {
        toValue: showSend ? 1 : 0,
        ...TIMING.springSnappy,
        useNativeDriver: true,
      }),
      Animated.spring(sendRotate, {
        toValue: showSend ? 1 : 0,
        ...TIMING.springSnappy,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showSend, sendScale, sendRotate]);

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: TIMING.fast,
      useNativeDriver: false,
    }).start();
    Animated.spring(plusRotate, {
      toValue: isFocused ? 1 : 0,
      ...TIMING.spring,
      useNativeDriver: true,
    }).start();
  }, [isFocused, focusAnim, plusRotate]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }, [text, onSend]);

  const placeholder = `Message ${brand.botName}...`;

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border ?? '#E5E7EB', COLORS.primary],
  });

  const sendRotation = sendRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '0deg'],
  });

  const plusRotation = plusRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View
      style={[
        styles.container,
        {paddingBottom: Math.max(insets.bottom, SPACING.sm)},
      ]}>
      <View style={styles.inputRow}>
        {/* Plus/attachment button */}
        <TouchableOpacity
          style={styles.plusButton}
          activeOpacity={0.6}
          accessibilityLabel="Attach"
          accessibilityRole="button">
          <Animated.View
            style={[
              styles.plusIconContainer,
              {transform: [{rotate: plusRotation}]},
            ]}>
            <View style={styles.plusH} />
            <View style={styles.plusV} />
          </Animated.View>
        </TouchableOpacity>

        {/* Input pill */}
        <Animated.View
          style={[
            styles.inputWrapper,
            {borderColor},
            isFocused && styles.inputWrapperFocused,
          ]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textSecondary + '80'}
            multiline
            maxLength={1000}
            returnKeyType="default"
            accessibilityLabel="Message input"
          />
        </Animated.View>

        {/* Send button */}
        <Animated.View
          style={{
            transform: [
              {scale: sendScale},
              {rotate: sendRotation},
            ],
            opacity: sendScale,
          }}>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            activeOpacity={0.7}
            accessibilityLabel="Send message"
            accessibilityRole="button">
            <View style={styles.sendArrowContainer}>
              <View style={styles.sendArrowStem} />
              <View style={styles.sendArrowHead} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm + 2,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border + '60',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  plusButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '0A',
    marginBottom: 1,
  },
  plusIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusH: {
    position: 'absolute',
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.primary,
  },
  plusV: {
    position: 'absolute',
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: COLORS.primary,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  inputWrapperFocused: {
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  input: {
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? SPACING.md : SPACING.sm + 2,
    paddingBottom: Platform.OS === 'ios' ? SPACING.md : SPACING.sm + 2,
    fontSize: 16,
    color: COLORS.text,
    maxHeight: 110,
    minHeight: 44,
    lineHeight: 22,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  sendArrowContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendArrowStem: {
    position: 'absolute',
    width: 2.5,
    height: 14,
    backgroundColor: COLORS.textInverse,
    borderRadius: 1.25,
  },
  sendArrowHead: {
    position: 'absolute',
    top: 0,
    width: 11,
    height: 11,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopColor: COLORS.textInverse,
    borderRightColor: COLORS.textInverse,
    transform: [{rotate: '-45deg'}],
  },
});
