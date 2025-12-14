/// <reference lib="webworker" />

import type { BookmarkItem, ReviewReminder, DigestSnapshot } from "@bookmarket/shared-kernel";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { computeNextScheduledFor, MAX_RENOTIFY_COUNT } from "../src/lib/reminders/reviewReminderPolicy";
import { REVIEW_REMINDER_ALARM_PREFIX } from "../src/lib/reminders/chromeReminderAlarms";

declare const self: ServiceWorkerGlobalScope;

const log = (...args: unknown[]) => {
  console.log("[bookmarket-sw]", ...args);
};

const errorLog = (...args: unknown[]) => {
  console.error("[bookmarket-sw]", ...args);
};

interface BookmarkDb extends DBSchema {
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
const DB_VERSION = 1;

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
      }
    });
  }
  return dbPromise;
}

async function createDigestSnapshot(nowIso: string) {
  const db = await getDatabase();
  const [bookmarks, reminders] = await Promise.all([db.getAll("bookmarks"), db.getAll("reminders")]);

  const unreadCount = bookmarks.filter((b) => b.status === "unread").length;
  const remindersDue = reminders.filter((r) => r.status === "scheduled" && Date.parse(r.scheduledFor) <= Date.parse(nowIso)).length;

  const snapshot: DigestSnapshot = {
    id: `digest_${Date.parse(nowIso)}`,
    generatedAt: nowIso,
    unreadCount,
    priorityItems: [],
    newSinceYesterday: 0,
    remindersDue
  };
  await db.put("digests", snapshot);
}

self.addEventListener("install", () => {
  log("installed");
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  log("activated");
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "PING") {
    event.ports[0]?.postMessage({ type: "PONG" });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    try {
      if (!alarm?.name?.startsWith(REVIEW_REMINDER_ALARM_PREFIX)) {
        log("alarm fired", alarm.name);
        return;
      }

      const reminderId = alarm.name.slice(REVIEW_REMINDER_ALARM_PREFIX.length);
      const db = await getDatabase();
      const reminder = await db.get("reminders", reminderId);
      if (!reminder) {
        log("reminder not found", reminderId);
        return;
      }

      if (reminder.status === "completed" || reminder.status === "exhausted") {
        log("reminder ignored (status)", reminderId, reminder.status);
        return;
      }

      const bookmark = await db.get("bookmarks", reminder.bookmarkId);
      const nowIso = new Date().toISOString();

      // 送信上限
      if (reminder.repeatCount >= MAX_RENOTIFY_COUNT) {
        await db.put("reminders", { ...reminder, status: "exhausted" });
        log("reminder exhausted", reminderId);
        await createDigestSnapshot(nowIso);
        return;
      }

      // 通知
      if (chrome.notifications) {
        const title = "Bookmarket: Review reminder";
        const message = bookmark
          ? `${bookmark.title}\n(${bookmark.url})`
          : `Bookmark: ${reminder.bookmarkId}`;

        await chrome.notifications.create(`review:${reminderId}:${Date.now()}`, {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title,
          message
        });
      }

      // 次回再通知をスケジュール
      const nextScheduledFor = computeNextScheduledFor(Date.now(), reminder.repeatCount);
      const nextRepeatCount = reminder.repeatCount + 1;
      if (!nextScheduledFor) {
        await db.put("reminders", { ...reminder, repeatCount: nextRepeatCount, status: "exhausted" });
        log("reminder exhausted (max reached)", reminderId, nextRepeatCount);
        await createDigestSnapshot(nowIso);
        return;
      }

      const updated: ReviewReminder = {
        ...reminder,
        repeatCount: nextRepeatCount,
        scheduledFor: nextScheduledFor,
        status: "scheduled"
      };
      await db.put("reminders", updated);

      await chrome.alarms.create(alarm.name, { when: Math.max(Date.now() + 1_000, Date.parse(nextScheduledFor)) });
      log("reminder rescheduled", reminderId, updated.repeatCount, updated.scheduledFor);

      await createDigestSnapshot(nowIso);
    } catch (err) {
      errorLog("alarm handler failed", alarm?.name, err);
    }
  })();
});

chrome.notifications?.onClicked.addListener(() => {
  try {
    void chrome.runtime.openOptionsPage();
  } catch (err) {
    errorLog("openOptionsPage failed", err);
  }
});
