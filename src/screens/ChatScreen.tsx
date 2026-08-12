import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  RefreshControl,
  Alert,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MessageBubble} from '../components/chat/MessageBubble';
import {TypingIndicator} from '../components/chat/TypingIndicator';
import {QuickReplies} from '../components/chat/QuickReplies';
import {InputToolbar} from '../components/chat/InputToolbar';
import {OperatingState} from '../components/common/OperatingState';
import {SourceDrawer} from '../components/chat/SourceDrawer';
import {SourceDrawerProvider} from '../hooks/useSourceDrawer';
import {EmptyState} from '../components/chat/EmptyState';
import {useChat} from '../hooks/useChat';
import {useConnectivity} from '../hooks/useConnectivity';
import {processMessage, clearConversationHistory} from '../services/orchestrator';
import {llmService} from '../services/llmService';
import {getMode} from '../services/llmRouter';
import {modelManager} from '../services/modelManager';
import {logger} from '../services/logger';
import {COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, TIMING} from '../constants/theme';
import type {BubblePosition} from '../constants/theme';
import type {BotMessage, QuickReply} from '../types/chat';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {shouldShowSuggestedReplies} from './chatState';

type RootStackParamList = {
  Chat: undefined;
  Settings: undefined;
  Onboarding: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type DateSeparator = {type: 'date-separator'; date: string; key: string};

// Chat item augmented with grouping metadata
type GroupedMessage = BotMessage & {
  bubblePosition: BubblePosition;
  showAvatar: boolean;
  showTimestamp: boolean;
};
type ChatItem = GroupedMessage | DateSeparator;

function isSeparator(item: ChatItem): item is DateSeparator {
  return (item as DateSeparator).type === 'date-separator';
}

function formatSeparatorLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'});
}

// Compute Messenger-style grouping positions
// Messages are stored newest-first (inverted FlatList), so index 0 = newest
function computeGrouping(messages: BotMessage[]): GroupedMessage[] {
  return messages.map((msg, i) => {
    const senderId = msg.user._id;
    // In inverted list: prev = newer (i-1), next = older (i+1)
    const newerMsg = i > 0 ? messages[i - 1] : null;
    const olderMsg = i < messages.length - 1 ? messages[i + 1] : null;

    const sameAsNewer = newerMsg && newerMsg.user._id === senderId;
    const sameAsOlder = olderMsg && olderMsg.user._id === senderId;

    let bubblePosition: BubblePosition;
    if (sameAsNewer && sameAsOlder) {
      bubblePosition = 'middle';
    } else if (sameAsNewer && !sameAsOlder) {
      // Has newer same-sender, no older same-sender → this is the first (oldest) in group
      bubblePosition = 'last'; // inverted: "last" visually = oldest in group
    } else if (!sameAsNewer && sameAsOlder) {
      // No newer same-sender, has older same-sender → this is the last (newest) in group
      bubblePosition = 'first'; // inverted: "first" visually = newest in group
    } else {
      bubblePosition = 'standalone';
    }

    const isBot = senderId === 'bot';
    // Show avatar on the visually bottom message of a bot group (newest = index closest to 0)
    const showAvatar = isBot && (bubblePosition === 'first' || bubblePosition === 'standalone');

    // Show timestamp on the visually bottom message of each group
    const showTimestamp = bubblePosition === 'first' || bubblePosition === 'standalone';

    return {
      ...msg,
      bubblePosition,
      showAvatar,
      showTimestamp,
    };
  });
}

function buildChatItems(messages: BotMessage[]): ChatItem[] {
  const grouped = computeGrouping(messages);
  const items: ChatItem[] = [];
  let lastDateKey = '';

  // Messages are newest-first. We insert date separators when the date changes
  // going from newer to older (reading top to bottom in inverted list = bottom to top visually)
  for (let i = grouped.length - 1; i >= 0; i--) {
    const msg = grouped[i];
    const d = new Date(msg.createdAt);
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    if (dateKey !== lastDateKey) {
      items.push({
        type: 'date-separator',
        date: formatSeparatorLabel(d),
        key: `sep-${dateKey}`,
      });
      lastDateKey = dateKey;
    }
    items.push(msg);
  }

  items.reverse();
  return items;
}

export function ChatScreen(_props: Props) {
  const {
    messages,
    isTyping,
    setTyping,
    addUserMessage,
    addStreamingBotMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
  } = useChat();
  const {isOnline} = useConnectivity();
  const insets = useSafeAreaInsets();
  const streamTextRef = useRef('');
  const flatListRef = useRef<FlatList>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;
  const scrollButtonScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Demo mode skips model load entirely. Quickstart stays under 5 minutes.
    if (getMode() === 'demo') return;
    (async () => {
      if (llmService.isLoaded() || llmService.isLoading()) return;
      const downloaded = await modelManager.isModelDownloaded();
      if (downloaded) {
        logger.info('ChatScreen', 'Model found, auto-loading...');
        try {
          await llmService.load();
          logger.info('ChatScreen', 'Model auto-loaded successfully');
        } catch (err) {
          logger.warn('ChatScreen', 'Model auto-load failed', err);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      scrollButtonOpacity.setValue(showScrollButton ? 1 : 0);
      scrollButtonScale.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(scrollButtonOpacity, {
        toValue: showScrollButton ? 1 : 0,
        duration: TIMING.fast,
        useNativeDriver: true,
      }),
      Animated.spring(scrollButtonScale, {
        toValue: showScrollButton ? 1 : 0.8,
        ...TIMING.spring,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reducedMotion, showScrollButton, scrollButtonOpacity, scrollButtonScale]);

  const getResponse = useCallback(
    async (text: string) => {
      setTyping(true);
      const streamingMsgId = addStreamingBotMessage() as string;
      streamTextRef.current = '';

      try {
        const response = await processMessage(text, {
          onToken: (token: string) => {
            streamTextRef.current += token;
            updateStreamingMessage(streamingMsgId, streamTextRef.current);
          },
          onToolStart: (toolName: string) => {
            setRunningTool(toolName);
          },
          onToolEnd: () => {
            setRunningTool(null);
          },
        });
        finalizeStreamingMessage(streamingMsgId, response.text, {
          source: response.source,
          suggestedReplies: response.suggestedReplies,
          queuedActionId: response.queuedActionId,
          audit: response.audit,
        });
      } catch {
        finalizeStreamingMessage(
          streamingMsgId,
          'Sorry, something went wrong. Please try again or call 211 for assistance.',
          {source: 'system'},
        );
      } finally {
        setTyping(false);
        setRunningTool(null);
      }
    },
    [setTyping, addStreamingBotMessage, updateStreamingMessage, finalizeStreamingMessage],
  );

  const handleSend = useCallback(
    (text: string) => {
      addUserMessage(text);
      getResponse(text);
    },
    [addUserMessage, getResponse],
  );

  const handleQuickReply = useCallback(
    (reply: QuickReply) => {
      handleSend(reply.value);
    },
    [handleSend],
  );

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({offset: 0, animated: true});
    setShowScrollButton(false);
  }, []);

  const handleScroll = useCallback(
    (event: any) => {
      const offset = event.nativeEvent.contentOffset.y;
      const shouldShow = offset > 200;
      if (shouldShow !== showScrollButton) {
        setShowScrollButton(shouldShow);
      }
    },
    [showScrollButton],
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Alert.alert('Clear conversation?', 'This will remove all messages and start fresh.', [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => setIsRefreshing(false),
      },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearConversationHistory();
          setIsRefreshing(false);
        },
      },
    ]);
  }, []);

  const latestBotMessage = useMemo(() => {
    return messages.find(m => m.user._id === 'bot');
  }, [messages]);

  const suggestedReplies = (latestBotMessage as BotMessage)?.suggestedReplies;

  const hasUserMessage = useMemo(() => messages.some(m => m.user._id === 'user'), [messages]);

  const chatItems = useMemo(() => buildChatItems(messages), [messages]);

  const renderItem = useCallback(({item}: {item: ChatItem}) => {
    if (isSeparator(item)) {
      return (
        <View style={styles.separatorRow}>
          <View style={styles.separatorLine} />
          <View style={styles.separatorPill}>
            <Text style={styles.separatorText}>{item.date}</Text>
          </View>
          <View style={styles.separatorLine} />
        </View>
      );
    }
    return (
      <MessageBubble
        message={item}
        position={item.bubblePosition}
        showAvatar={item.showAvatar}
        showTimestamp={item.showTimestamp}
      />
    );
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <OperatingState
        mode={getMode()}
        isOnline={isOnline}
        localReady={llmService.isLoaded()}
        cloudReady={getMode() === 'prefer-online' && isOnline}
      />
      <FlatList
        ref={flatListRef}
        data={chatItems}
        renderItem={renderItem}
        keyExtractor={item => (isSeparator(item) ? item.key : String(item._id))}
        inverted
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={handleScroll}
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.textSecondary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {isTyping && <TypingIndicator />}
            {runningTool && (
              <View
                style={styles.toolRunningPill}
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Running ${runningTool}`}>
                <View style={styles.toolRunningDot} />
                <Text style={styles.toolRunningText} numberOfLines={1}>
                  Running {runningTool}...
                </Text>
              </View>
            )}
            {shouldShowSuggestedReplies({hasUserMessage, isTyping, suggestedReplies}) && (
              <QuickReplies replies={suggestedReplies ?? []} onPress={handleQuickReply} />
            )}
          </View>
        }
        ListFooterComponent={
          !hasUserMessage ? <EmptyState onQuickReply={handleQuickReply} /> : null
        }
      />

      <Animated.View
        style={[
          styles.scrollFab,
          {
            opacity: scrollButtonOpacity,
            transform: [{scale: scrollButtonScale}],
            bottom: 72 + (insets.bottom || SPACING.sm),
          },
        ]}
        pointerEvents={showScrollButton ? 'auto' : 'none'}>
        <TouchableOpacity
          style={styles.scrollFabButton}
          onPress={scrollToBottom}
          activeOpacity={0.7}
          accessibilityLabel="Scroll to bottom"
          accessibilityRole="button">
          <View style={styles.scrollChevron}>
            <View style={styles.chevronLeft} />
            <View style={styles.chevronRight} />
          </View>
        </TouchableOpacity>
      </Animated.View>

      <InputToolbar onSend={handleSend} />
      <SourceDrawer />
    </KeyboardAvoidingView>
  );
}

function ChatScreenWithDrawer(props: Props) {
  return (
    <SourceDrawerProvider>
      <ChatScreen {...props} />
    </SourceDrawerProvider>
  );
}

export default ChatScreenWithDrawer;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  messageList: {
    paddingHorizontal: SPACING.xs,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  listHeader: {
    paddingTop: SPACING.xs,
  },
  scrollFab: {
    position: 'absolute',
    right: SPACING.lg,
    zIndex: 10,
  },
  scrollFabButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scrollChevron: {
    width: 14,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronLeft: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    transform: [{rotate: '45deg'}, {translateX: -2}],
  },
  chevronRight: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    transform: [{rotate: '-45deg'}, {translateX: 2}],
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },
  separatorPill: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  separatorText: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  toolRunningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: (COLORS.primary ?? '#0891B2') + '14',
    marginTop: SPACING.sm,
    marginLeft: SPACING.lg,
    gap: 8,
  },
  toolRunningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary ?? '#0891B2',
  },
  toolRunningText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary ?? '#0891B2',
    fontWeight: '600',
  },
});
