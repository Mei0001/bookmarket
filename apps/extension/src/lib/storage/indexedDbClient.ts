import type { BookmarkItem, ReviewReminder, DigestSnapshot, SocialSignal, ExportJob } from "@bookmarket/shared-kernel";
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
  socialSignals: {
    key: SocialSignal["id"];
    value: SocialSignal;
    indexes: { bookmarkId: string; fetchedFrom: string; fetchedAt: string };
  };
  exportJobs: {
    key: ExportJob["id"];
    value: ExportJob;
    indexes: { status: string; requestedAt: string };
  };
}

const DB_NAME = "bookmarket-db";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<BookmarkDb>> | null = null;

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDB<BookmarkDb>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
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

        // socialSignals
        if (!db.objectStoreNames.contains("socialSignals")) {
          const store = db.createObjectStore("socialSignals", { keyPath: "id" });
          store.createIndex("bookmarkId", "bookmarkId", { unique: false });
          store.createIndex("fetchedFrom", "fetchedFrom", { unique: false });
          store.createIndex("fetchedAt", "fetchedAt", { unique: false });
        } else {
          const store = transaction.objectStore("socialSignals");
          if (!store.indexNames.contains("bookmarkId")) store.createIndex("bookmarkId", "bookmarkId", { unique: false });
          if (!store.indexNames.contains("fetchedFrom")) store.createIndex("fetchedFrom", "fetchedFrom", { unique: false });
          if (!store.indexNames.contains("fetchedAt")) store.createIndex("fetchedAt", "fetchedAt", { unique: false });
        }

        // exportJobs
        if (!db.objectStoreNames.contains("exportJobs")) {
          const store = db.createObjectStore("exportJobs", { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("requestedAt", "requestedAt", { unique: false });
        } else {
          const store = transaction.objectStore("exportJobs");
          if (!store.indexNames.contains("status")) store.createIndex("status", "status", { unique: false });
          if (!store.indexNames.contains("requestedAt")) store.createIndex("requestedAt", "requestedAt", { unique: false });
        }
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

export async function persistBookmark(record: BookmarkItem) {
  const db = await getDatabase();
  await db.put("bookmarks", record);
}

export async function getAllBookmarks() {
  const db = await getDatabase();
  return db.getAll("bookmarks");
}

export async function getBookmark(id: string) {
  const db = await getDatabase();
  return db.get("bookmarks", id);
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

export async function getAllReminders() {
  const db = await getDatabase();
  return db.getAll("reminders");
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

export async function persistSocialSignal(signal: SocialSignal) {
  const db = await getDatabase();
  await db.put("socialSignals", signal);
}

export async function getSocialSignal(id: string) {
  const db = await getDatabase();
  return db.get("socialSignals", id);
}

export async function getSocialSignalsByBookmark(bookmarkId: string) {
  const db = await getDatabase();
  return db.getAllFromIndex("socialSignals", "bookmarkId", bookmarkId);
}

export async function persistExportJob(job: ExportJob) {
  const db = await getDatabase();
  await db.put("exportJobs", job);
}

export async function getExportJob(id: string) {
  const db = await getDatabase();
  return db.get("exportJobs", id);
}

export async function getRecentExportJobs(limit = 5) {
  const db = await getDatabase();
  const index = db.transaction("exportJobs", "readonly").store.index("requestedAt");
  const jobs: ExportJob[] = [];
  let cursor = await index.openCursor(undefined, "prev");
  while (cursor && jobs.length < limit) {
    jobs.push(cursor.value);
    cursor = await cursor.continue();
  }
  return jobs;
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

