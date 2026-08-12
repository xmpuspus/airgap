import {conversationStore} from './conversationStore';
import {offlineQueue} from './offlineQueue';
import {clearBuffer} from './telemetry';
import {modelManager} from './modelManager';
import {clearSecureStore} from './secureStorage';
import {clearDownloadedKnowledge} from './syncService';

export interface DataDeletionResult {
  id: string;
  ok: boolean;
  error?: string;
}

const operations: ReadonlyArray<{
  id: string;
  run: () => void | Promise<void>;
}> = [
  {id: 'conversation', run: () => conversationStore.clear()},
  {id: 'offline-queue', run: () => offlineQueue.clear()},
  {id: 'telemetry-buffer', run: () => clearBuffer()},
  {id: 'knowledge-files', run: () => clearDownloadedKnowledge()},
  {id: 'kb-sync', run: () => clearSecureStore('kb-sync')},
  {id: 'model-files', run: () => modelManager.deleteModel()},
  {id: 'model-manager', run: () => clearSecureStore('model-manager')},
  {id: 'user-prefs', run: () => clearSecureStore('user-prefs')},
  {id: 'app-state', run: () => clearSecureStore('app-state')},
];

export async function deleteAllUserData(): Promise<DataDeletionResult[]> {
  const results: DataDeletionResult[] = [];
  for (const operation of operations) {
    try {
      await operation.run();
      results.push({id: operation.id, ok: true});
    } catch (error) {
      results.push({
        id: operation.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
