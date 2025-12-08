import type { BookmarkItem, ReviewReminder, DigestSnapshot } from "@bookmarket/shared-kernel";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface BookmarkDb extends DBSchema {
  bookmarks: {
    key: string;
    value: BookmarkItem;
    indexes: { sourceRuleId: string; status: string };
  };
  reminders: {
    key: string;
    value: ReviewReminder;
    indexes: { bookmarkId: string; status: string };
  };
  digests: {
    key: string;
    value: DigestSnapshot;
    indexes: { generatedAt: string };
  };
}

const DB_NAME = "bookmarket-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BookmarkDb>> | null = null;

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDB<BookmarkDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const bookmarkStore = db.createObjectStore("bookmarks", { keyPath: "id" });
        bookmarkStore.createIndex("sourceRuleId", "sourceRuleId", { unique: false });
        bookmarkStore.createIndex("status", "status", { unique: false });

        const reminderStore = db.createObjectStore("reminders", { keyPath: "id" });
        reminderStore.createIndex("bookmarkId", "bookmarkId", { unique: false });
        reminderStore.createIndex("status", "status", { unique: false });

        const digestStore = db.createObjectStore("digests", { keyPath: "id" });
        digestStore.createIndex("generatedAt", "generatedAt", { unique: false });
      }
    });
  }
  return dbPromise;
}

export async function persistBookmarks(records: BookmarkItem[]) {
  const db = await getDatabase();
  const tx = db.transaction("bookmarks", "readwrite");
  await Promise.all(records.map((record) => tx.store.put(record)));
  await tx.done;
}

export async function getAllBookmarks() {
  const db = await getDatabase();
  return db.getAll("bookmarks");
}

export async function deleteBookmarks(ids: string[]) {
  const db = await getDatabase();
  const tx = db.transaction("bookmarks", "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

export async function persistReminder(reminder: ReviewReminder) {
  const db = await getDatabase();
  await db.put("reminders", reminder);
}

export async function getReminder(id: string) {
  const db = await getDatabase();
  return db.get("reminders", id);
}

export async function getRemindersByBookmark(bookmarkId: string) {
  const db = await getDatabase();
  return db.getAllFromIndex("reminders", "bookmarkId", bookmarkId);
}

export async function persistDigestSnapshot(snapshot: DigestSnapshot) {
  const db = await getDatabase();
  await db.put("digests", snapshot);
}

export async function getRecentDigests(limit = 3) {
  const db = await getDatabase();
  const tx = db.transaction("digests", "readonly");
  const snapshots = await tx.store.getAll();
  return snapshots.sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1)).slice(0, limit);
}

export const LocalStorageKeys = {
  lastSyncHash: "bookmarket:lastSyncHash",
  lastSyncAt: "bookmarket:lastSyncAt",
  onboardingDismissed: "bookmarket:onboardingDismissed"
} as const;

export function setLocalValue<T>(key: (typeof LocalStorageKeys)[keyof typeof LocalStorageKeys], value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getLocalValue<T>(key: (typeof LocalStorageKeys)[keyof typeof LocalStorageKeys]): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch (error) {
      console.warn("Failed to enable persistent storage", error);
    }
  }
}

