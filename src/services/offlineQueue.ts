import {v4 as uuidv4} from 'uuid';
import type {QueuedAction} from '../types/chat';
import {config, actions, interpolate} from '../config/loader';
import {getBackendConnector} from './backendConnector';
import {logger} from './logger';
import {getSecureStore} from './secureStorage';
import type {QueueRecord} from './actionQueueTypes';

const queueStorage = () => getSecureStore('offline-queue');
const QUEUE_KEY = 'queued_actions';

function mockResponseFor(actionType: string): string {
  const action = actions.find(a => a.id === actionType);
  if (!action?.mockResponse) return 'Your request has been processed.';
  return interpolate(action.mockResponse, config);
}

async function executeQueuedAction(action: QueueRecord): Promise<string> {
  const backend = getBackendConnector();
  const options = {idempotencyKey: action.id};
  switch (action.type) {
    case 'balance_check': {
      const r = await backend.checkBalance('current', options);
      return `Balance: ${r.balance}. Data: ${r.data}. Active promo: ${r.promos}.`;
    }
    case 'plan_change': {
      const r = await backend.changePlan('current', '', options);
      return r.message;
    }
    case 'ticket_create': {
      const r = await backend.createTicket(action.query, options);
      return r.message;
    }
    case 'outage_check': {
      const r = await backend.checkOutage(undefined, options);
      return r.message;
    }
    case 'account_action':
      return 'Account change requires in-store verification. Please visit any store with a valid ID.';
    case 'tool_call': {
      const r = await backend.executeAction(
        action.toolName ?? 'unknown',
        {
          query: action.query,
        },
        options,
      );
      return r.message;
    }
    default:
      return mockResponseFor(action.type);
  }
}

class OfflineQueueService {
  private listeners = new Set<(records: QueueRecord[]) => void>();

  getQueue(): QueuedAction[] {
    const raw = queueStorage().getString(QUEUE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveQueue(queue: QueuedAction[]) {
    queueStorage().set(QUEUE_KEY, JSON.stringify(queue));
    for (const listener of this.listeners) listener(queue.map(record => ({...record})));
  }

  enqueue(
    type: QueuedAction['type'],
    query: string,
    chatMessageId: string,
    toolName?: string,
  ): QueuedAction {
    const action: QueuedAction = {
      id: uuidv4(),
      type,
      toolName,
      query,
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
      chatMessageId,
    };
    const queue = this.getQueue();
    queue.push(action);
    this.saveQueue(queue);
    return action;
  }

  async processQueue(): Promise<{action: QueuedAction; response: string}[]> {
    const queue = this.getQueue();
    const maxRetries = (config as any).queue?.maxRetries ?? 3;
    const pending = queue.filter(a => a.status === 'pending' && a.retryCount < maxRetries);
    const results: {action: QueuedAction; response: string}[] = [];

    for (const action of pending) {
      action.status = 'processing';
      this.saveQueue(queue);

      try {
        const response = await executeQueuedAction(action);
        action.status = 'completed';
        action.completedAt = Date.now();
        delete action.errorCode;
        delete action.errorMessage;
        this.saveQueue(queue);
        results.push({action, response});
      } catch (error) {
        action.status = 'failed';
        action.retryCount += 1;
        action.errorCode = 'backend_error';
        action.errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('offlineQueue', 'backend execution failed', {
          type: action.type,
          retryCount: action.retryCount,
        });
        this.saveQueue(queue);
        results.push({action, response: ''});
      }
    }

    return results;
  }

  removeCompleted() {
    const queue = this.getQueue().filter(a => a.status !== 'completed');
    this.saveQueue(queue);
  }

  retry(id: string): QueuedAction {
    const queue = this.getQueue();
    const action = queue.find(record => record.id === id);
    if (!action) throw new Error('queue_record_not_found');
    const maxRetries = (config as any).queue?.maxRetries ?? 3;
    if (action.retryCount >= maxRetries) throw new Error('queue_retry_limit');
    action.status = 'pending';
    delete action.errorCode;
    delete action.errorMessage;
    this.saveQueue(queue);
    return action;
  }

  remove(id: string): void {
    this.saveQueue(this.getQueue().filter(record => record.id !== id));
  }

  subscribe(listener: (records: QueueRecord[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getQueueSize(): number {
    return this.getQueue().filter(a => a.status === 'pending').length;
  }

  clear() {
    queueStorage().remove(QUEUE_KEY);
    for (const listener of this.listeners) listener([]);
  }
}

export const offlineQueue = new OfflineQueueService();
