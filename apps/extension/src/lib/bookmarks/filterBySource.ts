import type { BookmarkItem, SourceRule } from "@bookmarket/shared-kernel";
import type { ChromeUrlBookmark } from "@/lib/bookmarks/chromeBookmarksAdapter";

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function matchesDomain(hostname: string, pattern: string): boolean {
  const p = pattern.toLowerCase();
  return hostname === p || hostname.endsWith(`.${p}`);
}

function toBookmarkItem(bookmark: ChromeUrlBookmark, sourceRule: SourceRule): BookmarkItem | null {
  // 現状の BookmarkItemSchema は https:// を要求しているため、US1では https のみ対象にする
  if (!bookmark.url.startsWith("https://")) return null;

  const savedAt = new Date(bookmark.dateAdded ?? Date.now()).toISOString();
  return {
    id: bookmark.id,
    sourceRuleId: sourceRule.id,
    title: bookmark.title || bookmark.url,
    url: bookmark.url,
    savedAt,
    status: "unread",
    note: null,
    duplicateOf: null,
    tags: [],
    lastUpdatedAt: savedAt,
  };
}

/**
 * SourceRule(type=domain) に一致する Chrome ブックマークのみ抽出し、BookmarkItemへ正規化する。
 *
 * - handle ルールは US1 では未使用（将来: X/Instagram等のhandle抽出）
 * - 同一URLは「最新 savedAt」を1件だけ残して重複を畳み込む（MVP）
 */
export function filterBookmarksBySourceRules(
  bookmarks: ChromeUrlBookmark[],
  sourceRules: SourceRule[]
): { items: BookmarkItem[]; matchedRuleIds: Set<string> } {
  const domainRules = sourceRules.filter((r) => r.type === "domain");

  const normalized: BookmarkItem[] = [];
  const matchedRuleIds = new Set<string>();

  for (const bookmark of bookmarks) {
    const host = hostnameOf(bookmark.url);
    if (!host) continue;

    const rule = domainRules.find((r) => matchesDomain(host, r.pattern));
    if (!rule) continue;

    const item = toBookmarkItem(bookmark, rule);
    if (!item) continue;

    matchedRuleIds.add(rule.id);
    normalized.push(item);
  }

  // URLで重複排除（最新のsavedAtを残す）
  const byUrl = new Map<string, BookmarkItem>();
  for (const item of normalized) {
    const prev = byUrl.get(item.url);
    if (!prev) {
      byUrl.set(item.url, item);
      continue;
    }
    if (new Date(item.savedAt).getTime() >= new Date(prev.savedAt).getTime()) {
      byUrl.set(item.url, item);
    }
  }

  const items = [...byUrl.values()].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  return { items, matchedRuleIds };
}

