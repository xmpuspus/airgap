import {config} from '../config/loader';

// The government example has no agency integration, so no request may reach
// a backend or the outbox.
export function isGovernmentDomain(): boolean {
  return config.llm?.supportDomain === 'government';
}

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueRecord {
  id: string;
  /** A configured action id, or tool_call with the tool in toolName. */
  type: string;
  toolName?: string;
  query: string;
  createdAt: number;
  completedAt?: number;
  status: QueueStatus;
  retryCount: number;
  errorCode?: 'backend_error' | 'no_agency_integration';
  errorMessage?: string;
  chatMessageId: string;
}
