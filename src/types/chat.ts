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

export interface QueuedAction {
  id: string;
  /**
   * Action identifier. The first five are the original telco-only action
   * types; the sixth is a catch-all for tool calls queued by the new tool
   * router so verticals can register arbitrary tool names without extending
   * this union every time.
   */
  type:
    | 'balance_check'
    | 'plan_change'
    | 'ticket_create'
    | 'outage_check'
    | 'account_action'
    | 'tool_call';
  /** Name of the tool that was queued (populated when type === 'tool_call') */
  toolName?: string;
  query: string;
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  chatMessageId: string;
}
