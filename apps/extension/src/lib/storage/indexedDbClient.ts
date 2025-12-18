import type { BookmarkItem, ReviewReminder, DigestSnapshot, SourceRule } from "@bookmarket/shared-kernel";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface BookmarkDb extends DBSchema {
  sourceRules: {
    key: SourceRule["id"];
    value: SourceRule;
    indexes: { userId: string; type: string };
  };
  bookmarks: {
    key: BookmarkItem["id"];
    value: BookmarkItem;
    indexes: { sourceRuleId: string; status: string };
  };
  reminders: {
    key: ReviewReminder["id"];
    value: ReviewReminder;
    indexes: { bookmarkId: string; status: string };
  };
  digests: {
    key: DigestSnapshot["id"];
    value: DigestSnapshot;
    indexes: { generatedAt: string };
  };
}

const DB_NAME = "bookmarket-db";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<BookmarkDb>> | null = null;

const isIndexedDbAvailable = () => typeof indexedDB !== "undefined";
const isLocalStorageAvailable = () => typeof localStorage !== "undefined";

async function getDatabase() {
  if (!dbPromise) {
    if (!isIndexedDbAvailable()) {
      throw new Error("IndexedDB is not available in this environment.");
    }

    dbPromise = openDB<BookmarkDb>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        // sourceRules
        if (!db.objectStoreNames.contains("sourceRules")) {
          const store = db.createObjectStore("sourceRules", { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
          store.createIndex("type", "type", { unique: false });
        } else {
          const store = transaction.objectStore("sourceRules");
          if (!store.indexNames.contains("userId")) store.createIndex("userId", "userId", { unique: false });
          if (!store.indexNames.contains("type")) store.createIndex("type", "type", { unique: false });
        }

        // bookmarks
        if (!db.objectStoreNames.contains("bookmarks")) {
          const store = db.createObjectStore("bookmarks", { keyPath: "id" });
          store.createIndex("sourceRuleId", "sourceRuleId", { unique: false });
          store.createIndex("status", "status", { unique: false });
        } else {
          const store = transaction.objectStore("bookmarks");
          if (!store.indexNames.contains("sourceRuleId")) store.createIndex("sourceRuleId", "sourceRuleId", { unique: false });
          if (!store.indexNames.contains("status")) store.createIndex("status", "status", { unique: false });
        }

        // reminders
        if (!db.objectStoreNames.contains("reminders")) {
          const store = db.createObjectStore("reminders", { keyPath: "id" });
          store.createIndex("bookmarkId", "bookmarkId", { unique: false });
          store.createIndex("status", "status", { unique: false });
        } else {
          const store = transaction.objectStore("reminders");
          if (!store.indexNames.contains("bookmarkId")) store.createIndex("bookmarkId", "bookmarkId", { unique: false });
          if (!store.indexNames.contains("status")) store.createIndex("status", "status", { unique: false });
        }

        // digests
        if (!db.objectStoreNames.contains("digests")) {
          const store = db.createObjectStore("digests", { keyPath: "id" });
          store.createIndex("generatedAt", "generatedAt", { unique: false });
        } else {
          const store = transaction.objectStore("digests");
          if (!store.indexNames.contains("generatedAt")) store.createIndex("generatedAt", "generatedAt", { unique: false });
        }
      }
    });

    // R-004: 対応環境のみ永続化を要求
    void requestPersistentStorage();
  }
  return dbPromise;
}

export async function persistSourceRule(rule: SourceRule) {
  const db = await getDatabase();
  await db.put("sourceRules", rule);
}

export async function persistSourceRules(rules: SourceRule[]) {
  const db = await getDatabase();
  const tx = db.transaction("sourceRules", "readwrite");
  await Promise.all(rules.map((rule) => tx.store.put(rule)));
  await tx.done;
}

export async function getAllSourceRules() {
  const db = await getDatabase();
  return db.getAll("sourceRules");
}

export async function getSourceRule(id: string) {
  const db = await getDatabase();
  return db.get("sourceRules", id);
}

export async function deleteSourceRule(id: string) {
  const db = await getDatabase();
  await db.delete("sourceRules", id);
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
  const index = db.transaction("digests", "readonly").store.index("generatedAt");
  const snapshots: DigestSnapshot[] = [];
  let cursor = await index.openCursor(undefined, "prev");
  while (cursor && snapshots.length < limit) {
    snapshots.push(cursor.value);
    cursor = await cursor.continue();
  }
  return snapshots;
}

export const LocalStorageKeys = {
  lastSyncHash: "bookmarket:lastSyncHash",
  lastSyncAt: "bookmarket:lastSyncAt",
  onboardingDismissed: "bookmarket:onboardingDismissed"
} as const;

export function setLocalValue<T>(key: (typeof LocalStorageKeys)[keyof typeof LocalStorageKeys], value: T) {
  if (!isLocalStorageAvailable()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getLocalValue<T>(key: (typeof LocalStorageKeys)[keyof typeof LocalStorageKeys]): T | null {
  if (!isLocalStorageAvailable()) return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function removeLocalValue(key: (typeof LocalStorageKeys)[keyof typeof LocalStorageKeys]) {
  if (!isLocalStorageAvailable()) return;
  localStorage.removeItem(key);
}

export async function requestPersistentStorage() {
  if (typeof navigator === "undefined") return;
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch (error) {
      console.warn("Failed to enable persistent storage", error);
    }
  }
}

