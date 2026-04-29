import {v4 as uuidv4} from 'uuid';
import type {QueuedAction} from '../types/chat';
import {config, actions, interpolate} from '../config/loader';
import {getBackendConnector} from './backendConnector';
import {logger} from './logger';
import {createKeyedMMKV} from './secretStore';

const storage = createKeyedMMKV('offline-queue');
const QUEUE_KEY = 'queued_actions';

function mockResponseFor(actionType: string): string {
  const action = actions.find(a => a.id === actionType);
  if (!action?.mockResponse) return 'Your request has been processed.';
  return interpolate(action.mockResponse, config);
}

async function executeQueuedAction(action: QueuedAction): Promise<string> {
  const backend = getBackendConnector();
  try {
    switch (action.type) {
      case 'balance_check': {
        const r = await backend.checkBalance('current');
        return `Balance: ${r.balance}. Data: ${r.data}. Active promo: ${r.promos}.`;
      }
      case 'plan_change': {
        const r = await backend.changePlan('current', '');
        return r.message;
      }
      case 'ticket_create': {
        const r = await backend.createTicket(action.query);
        return r.message;
      }
      case 'outage_check': {
        const r = await backend.checkOutage();
        return r.message;
      }
      case 'account_action':
        return 'Account change requires in-store verification. Please visit any store with a valid ID.';
      case 'tool_call': {
        const r = await backend.executeAction(action.toolName ?? 'unknown', {
          query: action.query,
        });
        return r.message;
      }
      default:
        return mockResponseFor(action.type);
    }
  } catch (err: any) {
    logger.warn('offlineQueue', 'backend execution failed, returning fallback copy', {
      type: action.type,
      error: err?.message,
    });
    return mockResponseFor(action.type);
  }
}

class OfflineQueueService {
  getQueue(): QueuedAction[] {
    const raw = storage.getString(QUEUE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveQueue(queue: QueuedAction[]) {
    storage.set(QUEUE_KEY, JSON.stringify(queue));
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
    const pending = queue.filter(a => a.status === 'pending');
    const results: {action: QueuedAction; response: string}[] = [];

    for (const action of pending) {
      action.status = 'processing';
      this.saveQueue(queue);

      const response = await executeQueuedAction(action);
      action.status = 'completed';
      this.saveQueue(queue);

      results.push({action, response});
    }

    return results;
  }

  removeCompleted() {
    const queue = this.getQueue().filter(a => a.status !== 'completed');
    this.saveQueue(queue);
  }

  getQueueSize(): number {
    return this.getQueue().filter(a => a.status === 'pending').length;
  }

  clear() {
    storage.remove(QUEUE_KEY);
  }
}

export const offlineQueue = new OfflineQueueService();
