/**
 * Offline Sync
 *
 * Processes the offline write queue when connectivity restores.
 * Replays failed POSTs, removes on success, drops after 3 retries.
 *
 * Primary consumer: service worker (via raw IndexedDB).
 * This module provides a client-side API for queue management.
 */

import {
  getOfflineQueue,
  removeFromQueue,
  updateQueueRetries,
  type OfflineQueueItem,
} from "./offline-cache";

const MAX_RETRIES = 3;

/**
 * Process all items in the offline queue.
 * Returns the number of successfully synced items.
 */
export async function processQueue(): Promise<number> {
  const items = await getOfflineQueue();
  let synced = 0;

  for (const item of items) {
    if (item.retries >= MAX_RETRIES) {
      await removeFromQueue(item.id);
      continue;
    }

    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: item.body,
      });

      if (response.ok) {
        await removeFromQueue(item.id);
        synced++;
      } else {
        await updateQueueRetries(item.id, item.retries + 1);
      }
    } catch {
      await updateQueueRetries(item.id, item.retries + 1);
    }
  }

  return synced;
}

/** Get the number of pending items in the queue. */
export async function getQueueCount(): Promise<number> {
  const items = await getOfflineQueue();
  return items.length;
}
