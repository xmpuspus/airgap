export type QueueActionType =
  | 'balance_check'
  | 'plan_change'
  | 'ticket_create'
  | 'outage_check'
  | 'account_action'
  | 'tool_call';

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueRecord {
  id: string;
  type: QueueActionType;
  toolName?: string;
  query: string;
  createdAt: number;
  completedAt?: number;
  status: QueueStatus;
  retryCount: number;
  errorCode?: 'backend_error';
  errorMessage?: string;
  chatMessageId: string;
}
