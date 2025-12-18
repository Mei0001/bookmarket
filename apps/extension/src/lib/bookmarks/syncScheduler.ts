import type { BookmarkItem, SourceRule } from "@bookmarket/shared-kernel";
import { BookmarkItemSchema } from "@bookmarket/shared-kernel";
import { fetchUrlBookmarks } from "@/lib/bookmarks/chromeBookmarksAdapter";
import { diffBookmarks, hashBookmarks } from "@/lib/bookmarks/bookmarkDiff";
import { filterBookmarksBySourceRules } from "@/lib/bookmarks/filterBySource";
import {
  LocalStorageKeys,
  deleteBookmarks,
  getAllBookmarks,
  setLocalValue,
  persistBookmarks,
} from "@/lib/storage/indexedDbClient";

export type BookmarkSyncResult = {
  items: BookmarkItem[];
  diff: ReturnType<typeof diffBookmarks>;
  lastSyncAt: string;
  matchedRuleIds: string[];
};

export async function syncBookmarksNow(sourceRules: SourceRule[]): Promise<BookmarkSyncResult> {
  const chromeBookmarks = await fetchUrlBookmarks();
  const { items: nextRaw, matchedRuleIds } = filterBookmarksBySourceRules(chromeBookmarks, sourceRules);

  // Zodで最終的に形を固定してから差分計算
  const next = nextRaw.map((item) => BookmarkItemSchema.parse(item));

  const previous = await getAllBookmarks();
  const diff = diffBookmarks(previous, next);

  if (diff.removed.length) {
    await deleteBookmarks(diff.removed.map((b) => b.id));
  }
  if (diff.created.length || diff.updated.length) {
    await persistBookmarks([...diff.created, ...diff.updated]);
  }

  const lastSyncAt = new Date().toISOString();
  const lastSyncHash = await hashBookmarks(next);
  setLocalValue(LocalStorageKeys.lastSyncAt, lastSyncAt);
  setLocalValue(LocalStorageKeys.lastSyncHash, lastSyncHash);

  return {
    items: next,
    diff,
    lastSyncAt,
    matchedRuleIds: [...matchedRuleIds],
  };
}

