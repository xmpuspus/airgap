import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  Clipboard,
  StyleSheet,
  Animated,
} from 'react-native';
import {
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
  TYPOGRAPHY,
  TIMING,
  BUBBLE_RADIUS,
  GROUP_SPACING,
} from '../../constants/theme';
import type {BubblePosition} from '../../constants/theme';
import {logger} from '../../services/logger';
import type {BotMessage} from '../../types/chat';
import {CitationChips} from './CitationChips';
import {AnswerProvenance} from './AnswerProvenance';
import {ActionReceipt} from './ActionReceipt';
import {offlineQueue} from '../../services/offlineQueue';
import type {QueueRecord} from '../../services/actionQueueTypes';
import {getStalenessInfo} from '../../services/syncService';
import {useReducedMotion} from '../../hooks/useReducedMotion';

const AVATAR_SIZE = 32;

const SOURCE_LABELS: Record<string, string> = {
  llm: 'AI',
  search: 'Knowledge',
  queue: 'Queued',
  tool: 'Action',
  refusal: 'Disclaimer',
  system: '',
};

const SOURCE_COLORS: Record<string, string> = {
  llm: COLORS.primary,
  search: COLORS.secondary,
  queue: COLORS.warning ?? COLORS.secondary,
  tool: COLORS.success ?? COLORS.primary,
  refusal: COLORS.warning ?? '#D97706',
};

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString('en-PH', {month: 'short', day: 'numeric'});
}

function StreamingCursor() {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) return;
    const blink = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.85,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [opacity, reducedMotion, scale]);

  return <Animated.View style={[styles.cursorBar, {opacity, transform: [{scaleY: scale}]}]} />;
}

type FeedbackValue = 'up' | 'down' | null;

function SourceBadge({source}: {source: string}) {
  const label = SOURCE_LABELS[source];
  const color = SOURCE_COLORS[source];
  if (!label || !color) return null;
  return (
    <View style={[styles.sourcePill, {backgroundColor: color + '14'}]}>
      <View style={[styles.sourceDot, {backgroundColor: color}]} />
      <Text style={[styles.sourcePillText, {color}]}>{label}</Text>
    </View>
  );
}

function FeedbackButtons({messageId}: {messageId: string | number}) {
  const [feedback, setFeedback] = useState<FeedbackValue>(null);
  const scaleUp = useRef(new Animated.Value(1)).current;
  const scaleDown = useRef(new Animated.Value(1)).current;

  const handleFeedback = (value: 'up' | 'down') => {
    const next = feedback === value ? null : value;
    setFeedback(next);
    const anim = value === 'up' ? scaleUp : scaleDown;
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(anim, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    logger.info('feedback', next ? `User gave thumbs ${next}` : 'User removed feedback', {
      messageId,
      feedback: next,
    });
  };

  return (
    <View style={styles.feedbackRow}>
      <Animated.View style={{transform: [{scale: scaleUp}]}}>
        <TouchableOpacity
          onPress={() => handleFeedback('up')}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          style={[styles.feedbackButton, feedback === 'up' && styles.feedbackButtonActive]}
          activeOpacity={0.6}
          accessibilityLabel="Helpful"
          accessibilityRole="button">
          <View style={[styles.thumbIcon, feedback === 'up' && styles.thumbIconActive]}>
            <View style={styles.thumbUp} />
            <View style={styles.thumbPalm} />
          </View>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={{transform: [{scale: scaleDown}]}}>
        <TouchableOpacity
          onPress={() => handleFeedback('down')}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          style={[styles.feedbackButton, feedback === 'down' && styles.feedbackButtonActive]}
          activeOpacity={0.6}
          accessibilityLabel="Not helpful"
          accessibilityRole="button">
          <View
            style={[
              styles.thumbIcon,
              styles.thumbIconDown,
              feedback === 'down' && styles.thumbIconActive,
            ]}>
            <View style={styles.thumbUp} />
            <View style={styles.thumbPalm} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function BotAvatar() {
  return (
    <View style={styles.avatar}>
      <Image
        source={require('../../../assets/images/airgap-avatar.png')}
        style={styles.avatarImage}
        resizeMode="cover"
      />
    </View>
  );
}

function AvatarSpacer() {
  return <View style={styles.avatarSpacer} />;
}

function FormattedText({text, isBot}: {text: string; isBot: boolean}) {
  const baseStyle = isBot ? styles.botText : styles.userText;
  const lines = text.split('\n');

  return (
    <View style={styles.formattedContainer}>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (trimmed === '') {
          return <View key={i} style={styles.lineSpacer} />;
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.replace(/^[-*]\s*/, '');
          return (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bulletDot, !isBot && styles.bulletDotUser]} />
              <Text style={[baseStyle, styles.bulletText]}>{renderInline(content, baseStyle)}</Text>
            </View>
          );
        }

        return (
          <Text key={i} style={baseStyle}>
            {renderInline(trimmed, baseStyle)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInline(text: string, baseStyle: any): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={[baseStyle, styles.boldText]}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

function ShieldGlyph({color}: {color: string}) {
  return (
    <View style={styles.shieldContainer} accessible={false}>
      <View style={[styles.shieldTop, {borderBottomColor: color + '33'}]} />
      <View style={[styles.shieldBody, {backgroundColor: color + '22', borderColor: color}]}>
        <View style={[styles.shieldTick, {backgroundColor: color}]} />
      </View>
    </View>
  );
}

function ToolPill({toolName, color}: {toolName: string; color: string}) {
  return (
    <View style={[styles.toolPill, {backgroundColor: color + '14', borderColor: color + '55'}]}>
      <View style={styles.toolCheck}>
        <View style={[styles.toolCheckShort, {backgroundColor: color}]} />
        <View style={[styles.toolCheckLong, {backgroundColor: color}]} />
      </View>
      <Text style={[styles.toolPillText, {color}]}>{toolName}</Text>
    </View>
  );
}

// Resolve corner radii from grouping position
function getBubbleRadii(isBot: boolean, position: BubblePosition) {
  const side = isBot ? BUBBLE_RADIUS.bot : BUBBLE_RADIUS.user;
  return side[position];
}

interface Props {
  message: BotMessage;
  position?: BubblePosition;
  showAvatar?: boolean;
  showTimestamp?: boolean;
}

export function MessageBubble({
  message,
  position = 'standalone',
  showAvatar = true,
  showTimestamp = true,
}: Props) {
  const isBot = message.user._id === 'bot';
  const reducedMotion = useReducedMotion();
  const [queueRecord, setQueueRecord] = useState<QueueRecord | null>(() =>
    message.queuedActionId
      ? offlineQueue.getQueue().find(record => record.id === message.queuedActionId) ?? null
      : null,
  );
  const source = message.source;
  const sourceLabel = source ? SOURCE_LABELS[source] : undefined;
  const isStreaming = message.isStreaming === true;
  const isRefusal = source === 'refusal';
  const isTool = source === 'tool';
  const showFeedback = isBot && !isStreaming && source !== 'system' && !isRefusal;
  const showSource = sourceLabel && sourceLabel.length > 0 && !isRefusal && !isTool;
  const isLastOrStandalone = position === 'last' || position === 'standalone';
  const showFooter =
    isLastOrStandalone && (showFeedback || showSource || (showTimestamp && !isStreaming));

  const radii = getBubbleRadii(isBot, position);

  const timestamp = useMemo(
    () => formatTimestamp(new Date(message.createdAt)),
    [message.createdAt],
  );

  const slideAnim = useRef(new Animated.Value(isBot ? -8 : 8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
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
    ]).start();
  }, [fadeAnim, reducedMotion, slideAnim]);

  useEffect(() => {
    if (!message.queuedActionId) return;
    return offlineQueue.subscribe(records => {
      setQueueRecord(records.find(record => record.id === message.queuedActionId) ?? null);
    });
  }, [message.queuedActionId]);

  const handleLongPress = useCallback(() => {
    Clipboard.setString(message.text);
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [message.text, flashAnim]);

  const refusalColor = SOURCE_COLORS.refusal;
  const toolColor = SOURCE_COLORS.tool;

  const bubbleStyle = {
    borderTopLeftRadius: radii.topLeft,
    borderTopRightRadius: radii.topRight,
    borderBottomLeftRadius: radii.bottomLeft,
    borderBottomRightRadius: radii.bottomRight,
  };

  // Spacing between grouped messages
  const verticalMargin =
    position === 'first' || position === 'middle'
      ? GROUP_SPACING.grouped
      : position === 'last'
      ? GROUP_SPACING.grouped
      : GROUP_SPACING.ungrouped;

  return (
    <Animated.View
      style={[
        styles.row,
        isBot ? styles.rowLeft : styles.rowRight,
        {
          opacity: fadeAnim,
          transform: [{translateX: slideAnim}],
          marginBottom: verticalMargin,
        },
      ]}>
      {isBot && (showAvatar && isLastOrStandalone ? <BotAvatar /> : <AvatarSpacer />)}
      <View style={isBot ? styles.botBubbleWrapper : styles.userBubbleWrapper}>
        {isTool && message.audit?.toolName && (
          <ToolPill toolName={message.audit.toolName} color={toolColor} />
        )}

        <Pressable onLongPress={handleLongPress} accessibilityHint="Long press to copy message">
          {isRefusal ? (
            <View
              style={[
                styles.refusalBubble,
                {
                  backgroundColor: refusalColor + '14',
                  borderLeftColor: refusalColor,
                },
              ]}
              accessibilityRole="text"
              accessibilityLabel={`Disclaimer: ${message.text}`}>
              <ShieldGlyph color={refusalColor} />
              <View style={styles.refusalColumn}>
                <Text style={[styles.refusalLabel, {color: refusalColor}]}>DISCLAIMER</Text>
                <FormattedText text={message.text} isBot={true} />
              </View>
              <Animated.View
                style={[styles.flashOverlay, {opacity: flashAnim, backgroundColor: '#FFFFFF'}]}
                pointerEvents="none"
              />
            </View>
          ) : (
            <View
              style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble, bubbleStyle]}>
              <FormattedText text={message.text} isBot={isBot} />
              {isStreaming && <StreamingCursor />}
              <Animated.View
                style={[
                  styles.flashOverlay,
                  {
                    opacity: flashAnim,
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: radii.topLeft,
                    borderTopRightRadius: radii.topRight,
                    borderBottomLeftRadius: radii.bottomLeft,
                    borderBottomRightRadius: radii.bottomRight,
                  },
                ]}
                pointerEvents="none"
              />
            </View>
          )}
        </Pressable>

        {isBot && isLastOrStandalone && !isStreaming && !isRefusal && (
          <>
            <AnswerProvenance
              source={message.source}
              kbVersion={getStalenessInfo().kbVersion}
              docIds={message.audit?.kbDocIds}
            />
            <CitationChips docIds={message.audit?.kbDocIds} />
          </>
        )}

        {queueRecord && (
          <ActionReceipt
            record={queueRecord}
            onRetry={async id => {
              offlineQueue.retry(id);
              await offlineQueue.processQueue();
            }}
            onRemove={id => offlineQueue.remove(id)}
          />
        )}

        {showFooter && (
          <View style={[styles.footer, isBot ? styles.footerLeft : styles.footerRight]}>
            {showFeedback && <FeedbackButtons messageId={message._id} />}
            {showSource && source && <SourceBadge source={source} />}
            {showTimestamp && !isStreaming && <Text style={styles.timestamp}>{timestamp}</Text>}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: GROUP_SPACING.ungrouped,
  },
  rowLeft: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  botBubbleWrapper: {
    maxWidth: '82%',
  },
  userBubbleWrapper: {
    alignItems: 'flex-end',
    maxWidth: '78%',
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
  avatarSpacer: {
    width: AVATAR_SIZE,
    marginRight: SPACING.sm,
  },
  bubble: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  botBubble: {
    backgroundColor: COLORS.botBubble,
    ...SHADOWS.sm,
  },
  userBubble: {
    backgroundColor: COLORS.userBubble,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  botText: {
    ...TYPOGRAPHY.body,
    color: COLORS.botBubbleText,
  },
  userText: {
    ...TYPOGRAPHY.body,
    color: COLORS.userBubbleText,
  },
  boldText: {
    fontWeight: '700',
  },
  formattedContainer: {
    gap: 3,
  },
  lineSpacer: {
    height: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 2,
    marginVertical: 2,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
    marginTop: 8,
    marginRight: SPACING.sm,
    opacity: 0.5,
  },
  bulletDotUser: {
    backgroundColor: COLORS.textInverse,
    opacity: 0.6,
  },
  bulletText: {
    flex: 1,
  },
  cursorBar: {
    width: 3,
    height: 18,
    backgroundColor: COLORS.primary,
    marginLeft: 2,
    marginTop: 6,
    borderRadius: 1.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.sm,
    paddingHorizontal: SPACING['2xs'],
  },
  footerLeft: {
    justifyContent: 'flex-start',
  },
  footerRight: {
    justifyContent: 'flex-end',
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 5,
  },
  sourceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  sourcePillText: {
    ...TYPOGRAPHY.micro,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: SPACING['2xs'],
  },
  feedbackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackButtonActive: {
    backgroundColor: COLORS.primary + '12',
  },
  thumbIcon: {
    width: 18,
    height: 18,
    opacity: 0.4,
  },
  thumbIconDown: {
    transform: [{rotate: '180deg'}],
  },
  thumbIconActive: {
    opacity: 0.85,
  },
  thumbUp: {
    width: 10,
    height: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    top: 0,
    left: 4,
  },
  thumbPalm: {
    width: 15,
    height: 7,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    bottom: 0,
    left: 1.5,
  },
  timestamp: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
    opacity: 0.7,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  refusalBubble: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  refusalColumn: {
    flex: 1,
    marginLeft: SPACING.sm + 2,
  },
  refusalLabel: {
    ...TYPOGRAPHY.micro,
    letterSpacing: 0.8,
    marginBottom: 4,
    fontWeight: '700',
  },
  shieldContainer: {
    width: 20,
    height: 24,
    alignItems: 'center',
    marginTop: 2,
  },
  shieldTop: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  shieldBody: {
    width: 20,
    height: 17,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldTick: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: SPACING.xs,
    marginLeft: SPACING['2xs'],
    gap: 6,
  },
  toolPillText: {
    ...TYPOGRAPHY.micro,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  toolCheck: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCheckShort: {
    position: 'absolute',
    width: 5,
    height: 1.8,
    borderRadius: 1,
    transform: [{rotate: '45deg'}, {translateX: -2}, {translateY: 1}],
  },
  toolCheckLong: {
    position: 'absolute',
    width: 8,
    height: 1.8,
    borderRadius: 1,
    transform: [{rotate: '-45deg'}, {translateX: 1}, {translateY: -1}],
  },
});
