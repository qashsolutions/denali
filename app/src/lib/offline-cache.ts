/**
 * IndexedDB Offline Cache
 *
 * Lightweight wrapper via `idb` for caching API responses offline.
 * All operations are try/catch guarded — gracefully degrades if
 * IndexedDB is unavailable (e.g. private browsing, Safari restrictions).
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "denali-offline-cache";
const DB_VERSION = 1;

export const STORES = {
  CONVERSATIONS: "conversations",
  HEALTH_DATA: "health-data",
  DIABETES_LOG: "diabetes-log",
  DIABETES_INSIGHTS: "diabetes-insights",
  PROFILE: "profile",
  OFFLINE_QUEUE: "offline-queue",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/** TTL constants in milliseconds */
export const TTL = {
  PROFILE: 4 * 60 * 60 * 1000, // 4 hours
  HEALTH_DATA: 24 * 60 * 60 * 1000, // 24 hours
  CONVERSATIONS: 24 * 60 * 60 * 1000,
  INSIGHTS: 24 * 60 * 60 * 1000,
  DIABETES_LOG: 24 * 60 * 60 * 1000,
} as const;

interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  cachedAt: number;
}

export interface OfflineQueueItem {
  id: string;
  url: string;
  method: string;
  body: string;
  createdAt: number;
  retries: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const store of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "key" });
          }
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** Write data to a store. Fire-and-forget safe. */
export async function cacheSet<T>(
  store: StoreName,
  key: string,
  data: T
): Promise<void> {
  try {
    const db = await getDB();
    const entry: CacheEntry<T> = { key, data, cachedAt: Date.now() };
    await db.put(store, entry);
  } catch {
    // IndexedDB unavailable — silent degrade
  }
}

/** Read data from a store. Returns null if missing or error. */
export async function cacheGet<T>(
  store: StoreName,
  key: string
): Promise<T | null> {
  try {
    const db = await getDB();
    const entry = (await db.get(store, key)) as CacheEntry<T> | undefined;
    return entry?.data ?? null;
  } catch {
    return null;
  }
}

/** Read data only if within TTL. Returns null if expired or missing. */
export async function cacheGetIfFresh<T>(
  store: StoreName,
  key: string,
  maxAgeMs: number
): Promise<{ data: T; cachedAt: number } | null> {
  try {
    const db = await getDB();
    const entry = (await db.get(store, key)) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > maxAgeMs) return null;
    return { data: entry.data, cachedAt: entry.cachedAt };
  } catch {
    return null;
  }
}

/** Add a failed request to the offline queue. */
export async function queueOfflineRequest(
  item: Omit<OfflineQueueItem, "id" | "createdAt" | "retries">
): Promise<void> {
  try {
    const db = await getDB();
    const queueItem: OfflineQueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      retries: 0,
    };
    // Use id as key for the queue store
    await db.put(STORES.OFFLINE_QUEUE, { key: queueItem.id, data: queueItem, cachedAt: Date.now() });
  } catch {
    // Silent degrade
  }
}

/** Get all items in the offline queue. */
export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const db = await getDB();
    const entries = (await db.getAll(STORES.OFFLINE_QUEUE)) as CacheEntry<OfflineQueueItem>[];
    return entries.map((e) => e.data).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

/** Remove an item from the offline queue by id. */
export async function removeFromQueue(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORES.OFFLINE_QUEUE, id);
  } catch {
    // Silent degrade
  }
}

/** Update retry count for a queued item. */
export async function updateQueueRetries(
  id: string,
  retries: number
): Promise<void> {
  try {
    const db = await getDB();
    const entry = (await db.get(STORES.OFFLINE_QUEUE, id)) as CacheEntry<OfflineQueueItem> | undefined;
    if (entry) {
      entry.data.retries = retries;
      await db.put(STORES.OFFLINE_QUEUE, entry);
    }
  } catch {
    // Silent degrade
  }
}
