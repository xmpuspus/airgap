import {useState, useCallback, useEffect} from 'react';
import {v4 as uuidv4} from 'uuid';
import type {BotMessage, MessageAudit, MessageUser, QuickReply} from '../types/chat';
import {config, brand, prompts, quickReplies, interpolate} from '../config/loader';

const BOT_USER: MessageUser = {_id: 'bot', name: brand.botName};
const CURRENT_USER: MessageUser = {_id: 'user', name: 'You'};

interface AddBotMessageOptions {
  suggestedReplies?: QuickReply[];
  source?: BotMessage['source'];
  queuedActionId?: string;
  audit?: MessageAudit;
}

export function useChat() {
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [isTyping, setTyping] = useState(false);

  useEffect(() => {
    const welcomeMessage: BotMessage = {
      _id: uuidv4(),
      text: interpolate(prompts.welcome, config),
      createdAt: new Date(),
      user: BOT_USER,
      source: 'system',
      suggestedReplies: quickReplies,
    };
    setMessages([welcomeMessage]);
  }, []);

  const addUserMessage = useCallback((text: string) => {
    const userMsg: BotMessage = {
      _id: uuidv4(),
      text,
      createdAt: new Date(),
      user: CURRENT_USER,
    };
    setMessages(prev => [userMsg, ...prev]);
    return userMsg;
  }, []);

  const addBotMessage = useCallback(
    (text: string, options?: AddBotMessageOptions) => {
      const botMsg: BotMessage = {
        _id: uuidv4(),
        text,
        createdAt: new Date(),
        user: BOT_USER,
        source: options?.source ?? 'llm',
        suggestedReplies: options?.suggestedReplies,
        queuedActionId: options?.queuedActionId,
        audit: options?.audit,
      };
      setMessages(prev => [botMsg, ...prev]);
      return botMsg;
    },
    [],
  );

  const addStreamingBotMessage = useCallback(() => {
    const botMsg: BotMessage = {
      _id: uuidv4(),
      text: '',
      createdAt: new Date(),
      user: BOT_USER,
      source: 'llm',
      isStreaming: true,
    };
    setMessages(prev => [botMsg, ...prev]);
    return botMsg._id;
  }, []);

  const updateStreamingMessage = useCallback(
    (msgId: string, text: string) => {
      setMessages(prev =>
        prev.map(m => (m._id === msgId ? {...m, text} : m)),
      );
    },
    [],
  );

  const finalizeStreamingMessage = useCallback(
    (msgId: string, text: string, options?: AddBotMessageOptions) => {
      setMessages(prev =>
        prev.map(m =>
          m._id === msgId
            ? {
                ...m,
                text,
                isStreaming: false,
                source: options?.source ?? 'llm',
                suggestedReplies: options?.suggestedReplies,
                queuedActionId: options?.queuedActionId,
                audit: options?.audit,
              }
            : m,
        ),
      );
    },
    [],
  );

  return {
    messages,
    isTyping,
    setTyping,
    addUserMessage,
    addBotMessage,
    addStreamingBotMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
    botUser: BOT_USER,
    currentUser: CURRENT_USER,
  };
}
