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
  /** Shared public-service decision, including unavailable integrations. */
  responseReason?: string;
  answerPath?: import('../core/publicService').PublicAnswer['answerPath'];
  sources?: import('../core/publicService').PublicSource[];
  groundingIssues?: string[];
  providerId?: import('../services/inference/types').InferenceProviderId;
  modelIdentity?: string;
  /** Set when a model failed and the answer came from records instead. */
  providerFailure?: {
    providerId?: import('../services/inference/types').InferenceProviderId;
    reason: string;
    message: string;
  };
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

export type {QueueRecord as QueuedAction} from '../services/actionQueueTypes';
