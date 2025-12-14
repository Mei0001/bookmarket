"use client";

import { useEffect, useMemo, useState } from "react";
import type { BookmarkItem, ReviewReminder } from "@bookmarket/shared-kernel";

import { fetchUrlBookmarks } from "./chromeBookmarksAdapter";
import {
  deleteReminder,
  getAllBookmarks,
  getAllReminders,
  persistBookmark,
  persistBookmarks,
  persistReminder
} from "../storage/indexedDbClient";
import { clearReviewReminderAlarm, scheduleReviewReminderAlarm } from "../reminders/chromeReminderAlarms";

export type FilterTab = "all" | BookmarkItem["status"];

export type UndoEntry = {
  beforeBookmark: BookmarkItem;
  afterBookmark: BookmarkItem;
  beforeReminder: ReviewReminder | null;
  afterReminder: ReviewReminder | null;
};

function nowIso() {
  return new Date().toISOString();
}

function makeReminderId(bookmarkId: string) {
  return `rr_${bookmarkId}_${Date.now()}`;
}

export function useBookmarkStateStore() {
  const [loading, setLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [remindersById, setRemindersById] = useState<Record<string, ReviewReminder>>({});
  const [filter, setFilter] = useState<FilterTab>("unread");
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  async function reload() {
    const [b, r] = await Promise.all([getAllBookmarks(), getAllReminders()]);
    b.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
    const map: Record<string, ReviewReminder> = {};
    for (const item of r) map[item.id] = item;
    setBookmarks(b);
    setRemindersById(map);
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return bookmarks;
    return bookmarks.filter((b) => b.status === filter);
  }, [bookmarks, filter]);

  async function pushUndo(entry: UndoEntry) {
    setUndoStack((prev) => [entry, ...prev].slice(0, 20));
  }

  async function undo() {
    const entry = undoStack[0];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(1));

    // after 側のアラームは掃除してから before を復元（安全寄り）
    if (entry.afterReminder) {
      await clearReviewReminderAlarm(entry.afterReminder.id);
    }
    if (entry.beforeReminder) {
      await scheduleReviewReminderAlarm(entry.beforeReminder.id, entry.beforeReminder.scheduledFor);
    }

    await persistBookmark(entry.beforeBookmark);
    if (entry.beforeReminder) {
      await persistReminder(entry.beforeReminder);
    } else if (entry.afterReminder) {
      await deleteReminder(entry.afterReminder.id);
    }

    await reload();
  }

  async function syncFromChrome() {
    setLoading(true);
    try {
      const existing = await getAllBookmarks();
      const existingById = new Map(existing.map((b) => [b.id, b]));

      const chromeBookmarks = await fetchUrlBookmarks();
      const httpsOnly = chromeBookmarks.filter((b) => b.url.startsWith("https://"));
      const now = nowIso();

      const next: BookmarkItem[] = httpsOnly.map((b) => {
        const prev = existingById.get(b.id);
        const savedAt = new Date(b.dateAdded ?? Date.now()).toISOString();
        return {
          id: b.id,
          sourceRuleId: prev?.sourceRuleId ?? "chrome-bookmarks",
          title: b.title || prev?.title || "(untitled)",
          url: b.url,
          savedAt: prev?.savedAt ?? savedAt,
          status: prev?.status ?? "unread",
          note: prev?.note ?? null,
          duplicateOf: prev?.duplicateOf,
          tags: prev?.tags ?? [],
          lastUpdatedAt: now,
          socialSignalId: prev?.socialSignalId,
          reminderId: prev?.reminderId
        };
      });

      await persistBookmarks(next);
      await reload();
    } finally {
      setLoading(false);
    }
  }

  async function updateBookmark(next: BookmarkItem, context?: { removeReminder?: boolean; newReminder?: ReviewReminder | null }) {
    const before = bookmarks.find((b) => b.id === next.id);
    if (!before) return;

    const beforeReminder = before.reminderId ? remindersById[before.reminderId] ?? null : null;
    const afterReminder = context?.newReminder ?? (next.reminderId ? remindersById[next.reminderId] ?? null : null);
    await pushUndo({ beforeBookmark: before, afterBookmark: next, beforeReminder, afterReminder });

    await persistBookmark(next);

    if (context?.newReminder) {
      await persistReminder(context.newReminder);
      await scheduleReviewReminderAlarm(context.newReminder.id, context.newReminder.scheduledFor);
    }

    if (context?.removeReminder && beforeReminder) {
      await persistReminder({ ...beforeReminder, status: "completed" });
      await clearReviewReminderAlarm(beforeReminder.id);
    }

    await reload();
  }

  async function toggleDone(bookmarkId: string) {
    const bookmark = bookmarks.find((b) => b.id === bookmarkId);
    if (!bookmark) return;

    const now = nowIso();
    const isDone = bookmark.status === "done";
    const next: BookmarkItem = {
      ...bookmark,
      status: isDone ? "unread" : "done",
      reminderId: undefined,
      lastUpdatedAt: now
    };
    await updateBookmark(next, { removeReminder: true, newReminder: null });
  }

  async function clearReminderFor(bookmarkId: string) {
    const bookmark = bookmarks.find((b) => b.id === bookmarkId);
    if (!bookmark || !bookmark.reminderId) return;

    const reminder = remindersById[bookmark.reminderId];
    const now = nowIso();
    const next: BookmarkItem = { ...bookmark, status: "unread", reminderId: undefined, lastUpdatedAt: now };
    await pushUndo({
      beforeBookmark: bookmark,
      afterBookmark: next,
      beforeReminder: reminder ?? null,
      afterReminder: null
    });

    await persistBookmark(next);
    if (reminder) {
      await persistReminder({ ...reminder, status: "completed" });
      await clearReviewReminderAlarm(reminder.id);
    }
    await reload();
  }

  async function snooze(bookmarkId: string, scheduledForIso: string) {
    const bookmark = bookmarks.find((b) => b.id === bookmarkId);
    if (!bookmark) return;

    const id = makeReminderId(bookmark.id);
    const reminder: ReviewReminder = {
      id,
      bookmarkId: bookmark.id,
      scheduledFor: new Date(Date.parse(scheduledForIso)).toISOString(),
      repeatCount: 0,
      status: "scheduled",
      channel: "digest"
    };

    const now = nowIso();
    const next: BookmarkItem = { ...bookmark, status: "snoozed", reminderId: id, lastUpdatedAt: now };
    await updateBookmark(next, { removeReminder: true, newReminder: reminder });
  }

  return {
    loading,
    bookmarks,
    remindersById,
    filter,
    filtered,
    undoStack,
    actions: {
      reload,
      setFilter,
      syncFromChrome,
      undo,
      toggleDone,
      clearReminderFor,
      snooze
    }
  };
}

