import type {BotMessage} from '../types/chat';
import type {ConversationTurn} from '../utils/promptBuilder';
import {features, privacy} from '../config/loader';
import {getSecureStore} from './secureStorage';

const SNAPSHOT_KEY = 'conversationSnapshot';
const listeners = new Set<(snapshot: ConversationSnapshot) => void>();

export interface ConversationSnapshot {
  messages: BotMessage[];
  turns: ConversationTurn[];
}

interface StoredConversationSnapshot extends ConversationSnapshot {
  updatedAt: number;
}

function emptySnapshot(): ConversationSnapshot {
  return {messages: [], turns: []};
}

function store() {
  return getSecureStore('conversation');
}

function notify(snapshot: ConversationSnapshot): void {
  for (const listener of listeners) listener(snapshot);
}

function parseSnapshot(raw: string): StoredConversationSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as StoredConversationSnapshot;
    if (
      !parsed ||
      !Array.isArray(parsed.messages) ||
      !Array.isArray(parsed.turns) ||
      typeof parsed.updatedAt !== 'number'
    ) {
      return null;
    }
    return {
      ...parsed,
      messages: parsed.messages.map(message => ({
        ...message,
        createdAt: new Date(message.createdAt),
      })),
    };
  } catch {
    return null;
  }
}

function loadStored(): StoredConversationSnapshot | null {
  const raw = store().getString(SNAPSHOT_KEY);
  if (!raw) return null;
  const snapshot = parseSnapshot(raw);
  if (!snapshot) {
    store().remove(SNAPSHOT_KEY);
    return null;
  }

  const sessionMs = (features.sessionTimeoutMinutes ?? 30) * 60 * 1000;
  const retentionMs = (privacy.dataRetentionDays ?? 30) * 24 * 60 * 60 * 1000;
  const age = Date.now() - snapshot.updatedAt;
  if (age > sessionMs || age > retentionMs) {
    store().remove(SNAPSHOT_KEY);
    return null;
  }
  return snapshot;
}

export const conversationStore = {
  load(): ConversationSnapshot {
    const snapshot = loadStored();
    return snapshot ? {messages: snapshot.messages, turns: snapshot.turns} : emptySnapshot();
  },

  save(snapshot: ConversationSnapshot): void {
    const stored: StoredConversationSnapshot = {
      messages: snapshot.messages,
      turns: snapshot.turns,
      updatedAt: Date.now(),
    };
    store().set(SNAPSHOT_KEY, JSON.stringify(stored));
    notify(snapshot);
  },

  saveMessages(messages: BotMessage[]): void {
    const current = loadStored();
    this.save({messages, turns: current?.turns ?? []});
  },

  saveTurns(turns: ConversationTurn[]): void {
    const current = loadStored();
    this.save({messages: current?.messages ?? [], turns});
  },

  clear(): void {
    store().remove(SNAPSHOT_KEY);
    notify(emptySnapshot());
  },

  subscribe(listener: (snapshot: ConversationSnapshot) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
