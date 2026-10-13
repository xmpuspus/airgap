import {v4 as uuidv4} from 'uuid';
import {config, brand, interpolate} from '../config/loader';
import {getBackendConnector, type BackendRequestOptions} from './backendConnector';
import {logger} from './logger';
import {getSecureStore} from './secureStorage';
import {isGovernmentDomain, type QueueRecord} from './actionQueueTypes';

const queueStorage = () => getSecureStore('offline-queue');
const QUEUE_KEY = 'queued_actions';

// No template prompt covers a failed request, and no follow-up comes after
// this reply, so it must not promise one.
export function unfinishedRequestReply(): string {
  return interpolate(
    'I could not complete that request right now. Please try again later or call {{hotline}}.',
    config,
  );
}

export function accountActionReply(): string {
  // hotlineLabel is optional, and an empty one would leave "()" in the text.
  const hotline = brand.hotlineLabel ? '{{hotline}} ({{hotlineLabel}})' : '{{hotline}}';
  return interpolate(
    'Account changes like cancellation, disconnection, or deactivation require verification. ' +
      `Please call ${hotline} or visit any {{brandName}} store with a valid ID to proceed.`,
    config,
  );
}

export interface BackendActionResult {
  data: Record<string, unknown>;
  summary: string;
}

// The chat, the tool router and the outbox all run actions here, so an action
// gets the same backend call on every path. The switch accepts both the
// configured action ids and the tool backend method names.
export async function runBackendAction(
  type: string,
  query: string,
  options?: BackendRequestOptions,
): Promise<BackendActionResult> {
  const backend = getBackendConnector();
  switch (type) {
    case 'balance_check':
    case 'checkBalance':
    case 'lookupBalance': {
      const r = await backend.checkBalance('current', options);
      return {
        data: {...r},
        summary: `Your current balance is ${r.balance}. Data remaining: ${r.data}. Active promo: ${r.promos}.`,
      };
    }
    case 'plan_change':
    case 'changePlan':
    case 'activateAddon': {
      const r = await backend.changePlan('current', '', options);
      return {data: {...r}, summary: r.message};
    }
    case 'ticket_create':
    case 'createTicket':
    case 'fileClaim':
    case 'disputeTransaction': {
      const r = await backend.createTicket(query, options);
      return {data: {...r}, summary: r.message};
    }
    case 'outage_check':
    case 'checkOutage':
    case 'reportOutage': {
      const r = await backend.checkOutage(undefined, options);
      return {data: {...r}, summary: r.message};
    }
    // An account change needs an identity check that the app cannot do, so no
    // request goes to the backend.
    case 'account_action':
      return {data: {}, summary: accountActionReply()};
    default: {
      const r = await backend.executeAction(type, {query}, options);
      return {data: {...r}, summary: r.message};
    }
  }
}

async function executeQueuedAction(action: QueueRecord): Promise<string> {
  if (isGovernmentDomain()) throw new Error('no_agency_integration');
  const result = await runBackendAction(action.toolName ?? action.type, action.query, {
    idempotencyKey: action.id,
  });
  return result.summary;
}

class OfflineQueueService {
  private listeners = new Set<(records: QueueRecord[]) => void>();
  private loaded = false;

  getQueue(): QueueRecord[] {
    const raw = queueStorage().getString(QUEUE_KEY);
    if (!raw) return [];
    let queue: QueueRecord[];
    try {
      queue = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!this.loaded) {
      this.loaded = true;
      // A record still marked processing at the first load lost its call when
      // the app stopped, so it runs again on the next cycle.
      const stranded = queue.filter(record => record.status === 'processing');
      for (const record of stranded) record.status = 'pending';
      if (stranded.length > 0) this.saveQueue(queue);
    }
    return queue;
  }

  private saveQueue(queue: QueueRecord[]) {
    queueStorage().set(QUEUE_KEY, JSON.stringify(queue));
    for (const listener of this.listeners) listener(queue.map(record => ({...record})));
  }

  enqueue(type: string, query: string, chatMessageId: string, toolName?: string): QueueRecord {
    if (isGovernmentDomain()) throw new Error('no_agency_integration');
    const action: QueueRecord = {
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

  async processQueue(): Promise<{action: QueueRecord; response: string}[]> {
    const queue = this.getQueue();
    const maxRetries = config.queue?.maxRetries ?? 3;
    const pending = queue.filter(a => a.status === 'pending' && a.retryCount < maxRetries);
    const results: {action: QueueRecord; response: string}[] = [];

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
        action.errorMessage = error instanceof Error ? error.message : String(error);
        action.errorCode =
          action.errorMessage === 'no_agency_integration'
            ? 'no_agency_integration'
            : 'backend_error';
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

  retry(id: string): QueueRecord {
    const queue = this.getQueue();
    const action = queue.find(record => record.id === id);
    if (!action) throw new Error('queue_record_not_found');
    if (action.errorCode === 'no_agency_integration') throw new Error('no_agency_integration');
    const maxRetries = config.queue?.maxRetries ?? 3;
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

  clear() {
    queueStorage().remove(QUEUE_KEY);
    for (const listener of this.listeners) listener([]);
  }
}

export const offlineQueue = new OfflineQueueService();
