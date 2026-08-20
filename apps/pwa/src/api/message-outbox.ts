import type { ChatMessage } from './types';

export interface QueuedMessage {
  id: string;
  text: string;
  file?: Blob;
  fileName?: string;
  replyToMessageId?: string;
  clientMutationId: string;
  createdAt: number;
}

const DB_NAME = 'lovecheck-message-outbox';
const STORE_NAME = 'messages';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function enqueueMessage(message: Omit<QueuedMessage, 'id' | 'createdAt'>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      ...message,
      id: message.clientMutationId,
      createdAt: Date.now(),
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
  db.close();
}

async function readQueue(): Promise<QueuedMessage[]> {
  const db = await openDb();
  if (!db) return [];
  const items = await new Promise<QueuedMessage[]>((resolve) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as QueuedMessage[]).sort((a, b) => a.createdAt - b.createdAt));
    request.onerror = () => resolve([]);
  });
  db.close();
  return items;
}

async function removeQueued(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
  db.close();
}

export async function flushMessageOutbox(
  send: (message: QueuedMessage) => Promise<ChatMessage>,
  onSent?: (message: ChatMessage) => void,
): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  for (const message of await readQueue()) {
    try {
      const sent = await send(message);
      await removeQueued(message.id);
      onSent?.(sent);
    } catch {
      break;
    }
  }
}
