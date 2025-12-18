import type { BookmarkItem } from "@bookmarket/shared-kernel";

import { diffById } from "@/lib/bookmarks/bookmarkDiff";
import { fetchUrlBookmarks } from "@/lib/bookmarks/chromeBookmarksAdapter";
import { getAllBookmarks, deleteBookmarks, persistBookmarks, setLocalValue, LocalStorageKeys } from "@/lib/storage/indexedDbClient";
import { listSourceRulesByUser, setSourceRuleSyncStatus } from "@/lib/sourceRules/sourceRuleRepository";
import { buildBookmarkItemsFromChrome, type SyncReport } from "@/lib/sync/bookmarkSync";

const isChromeBookmarksAvailable = () => typeof chrome !== "undefined" && !!chrome.bookmarks;

function equalsBookmark(a: BookmarkItem, b: BookmarkItem) {
  return (
    a.id === b.id &&
    a.sourceRuleId === b.sourceRuleId &&
    a.title === b.title &&
    a.url === b.url &&
    a.savedAt === b.savedAt &&
    a.status === b.status &&
    (a.note ?? null) === (b.note ?? null) &&
    (a.duplicateOf ?? null) === (b.duplicateOf ?? null) &&
    JSON.stringify(a.tags ?? []) === JSON.stringify(b.tags ?? [])
  );
}

export async function syncBookmarksFromChrome(params?: { userId?: string }): Promise<SyncReport> {
  if (!isChromeBookmarksAvailable()) {
    throw new Error("Chrome bookmarks API が利用できません（拡張環境で実行してください）。");
  }

  const now = new Date().toISOString();
  const userId = params?.userId ?? "local";
  const rules = (await listSourceRulesByUser(userId)).filter((r) => r.type === "domain");
  if (rules.length === 0) {
    return { totalChromeBookmarks: 0, matched: 0, deduped: 0, persisted: 0, removed: 0 };
  }

  await Promise.all(rules.map((r) => setSourceRuleSyncStatus(r.id, { syncStatus: "syncing", errorMessage: null })));

  try {
    const chromeBookmarks = await fetchUrlBookmarks();
    const { bookmarks: next, report } = await buildBookmarkItemsFromChrome({ sourceRules: rules, chromeBookmarks, now });

    const relevantRuleIds = new Set(rules.map((r) => r.id));
    const previousAll = await getAllBookmarks();
    const previous = previousAll.filter((b) => relevantRuleIds.has(b.sourceRuleId));

    const diff = diffById(previous, next, { equals: equalsBookmark });
    const updatedWithTimestamp = diff.updated.map((b) => ({ ...b, lastUpdatedAt: now }));

    await persistBookmarks([...diff.created, ...updatedWithTimestamp]);
    await deleteBookmarks(diff.removed.map((b) => b.id));

    setLocalValue(LocalStorageKeys.lastSyncAt, now);

    await Promise.all(rules.map((r) => setSourceRuleSyncStatus(r.id, { syncStatus: "idle", lastSyncedAt: now, errorMessage: null })));

    return {
      ...report,
      persisted: diff.created.length + diff.updated.length,
      removed: diff.removed.length
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    await Promise.all(rules.map((r) => setSourceRuleSyncStatus(r.id, { syncStatus: "error", errorMessage: message })));
    throw error;
  }
}

