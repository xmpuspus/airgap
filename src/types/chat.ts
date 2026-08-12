export interface MessageUser {
  _id: 'bot' | 'user';
  name: string;
  avatar?: string;
}

export interface MessageAudit {
  kbDocIds?: string[];
  confidence?: number;
  toolName?: string;
  refusalReason?: string;
  groundingIssues?: string[];
}

export interface BotMessage {
  _id: string;
  text: string;
  createdAt: Date;
  user: MessageUser;
  source?: 'llm' | 'search' | 'system' | 'queue' | 'tool' | 'refusal';
  isStreaming?: boolean;
  suggestedReplies?: QuickReply[];
  queuedActionId?: string;
  audit?: MessageAudit;
}

export interface QuickReply {
  title: string;
  value: string;
}

export interface ChatState {
  messages: BotMessage[];
  isTyping: boolean;
  isModelLoaded: boolean;
  isModelDownloaded: boolean;
  isOnline: boolean;
}

export type {QueueRecord as QueuedAction} from '../services/actionQueueTypes';
