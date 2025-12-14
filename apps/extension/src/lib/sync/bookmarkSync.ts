import type { BookmarkItem, SourceRule } from "@bookmarket/shared-kernel";

import type { ChromeUrlBookmark } from "@/lib/bookmarks/chromeBookmarksAdapter";

export type BookmarkSortKey = "savedAtDesc" | "savedAtAsc" | "titleAsc";

export interface SyncReport {
  totalChromeBookmarks: number;
  matched: number;
  deduped: number;
  persisted: number;
  removed: number;
}

function normalizeUrlForDedupe(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return null;
  }
}

function matchesDomain(hostname: string, domainPattern: string) {
  const h = hostname.toLowerCase();
  const p = domainPattern.toLowerCase();
  return h === p || h.endsWith(`.${p}`);
}

function pickBestRule(hostname: string, rules: SourceRule[]) {
  let best: SourceRule | null = null;
  for (const rule of rules) {
    if (rule.type !== "domain") continue;
    if (!matchesDomain(hostname, rule.pattern)) continue;
    if (!best) best = rule;
    else if (rule.pattern.length > best.pattern.length) best = rule;
  }
  return best;
}

async function sha256Hex(input: string) {
  if (!globalThis.crypto?.subtle) throw new Error("WebCrypto is not available (crypto.subtle).");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

async function bookmarkIdFromUrl(url: string) {
  const hex = await sha256Hex(url);
  return `bm_${hex.slice(0, 16)}`;
}

export async function buildBookmarkItemsFromChrome(params: {
  sourceRules: SourceRule[];
  chromeBookmarks: ChromeUrlBookmark[];
  now?: string;
}): Promise<{ bookmarks: BookmarkItem[]; report: Omit<SyncReport, "persisted" | "removed"> }> {
  const now = params.now ?? new Date().toISOString();
  const domainRules = params.sourceRules.filter((r) => r.type === "domain");

  const byUrl = new Map<string, BookmarkItem>();
  let matched = 0;

  for (const item of params.chromeBookmarks) {
    const normalizedUrl = normalizeUrlForDedupe(item.url);
    if (!normalizedUrl) continue;

    let hostname: string;
    try {
      hostname = new URL(normalizedUrl).hostname;
    } catch {
      continue;
    }

    const rule = pickBestRule(hostname, domainRules);
    if (!rule) continue;
    matched += 1;

    const savedAt = item.dateAdded ? new Date(item.dateAdded).toISOString() : now;
    const id = await bookmarkIdFromUrl(normalizedUrl);
    const existing = byUrl.get(normalizedUrl);

    const candidate: BookmarkItem = {
      id,
      sourceRuleId: rule.id,
      title: item.title?.trim() ? item.title.trim() : hostname,
      url: normalizedUrl,
      savedAt,
      status: "unread",
      note: null,
      duplicateOf: null,
      tags: [],
      lastUpdatedAt: now
    };

    if (!existing) {
      byUrl.set(normalizedUrl, candidate);
      continue;
    }

    // 重複URLの場合、より新しい savedAt を採用しつつ title は空でない方を優先
    const existingSavedAt = Date.parse(existing.savedAt);
    const candidateSavedAt = Date.parse(candidate.savedAt);
    const better = candidateSavedAt > existingSavedAt ? candidate : existing;
    // title は「ホスト名フォールバック」よりも、実ブックマーク由来のタイトルを優先
    const isExistingFallback = existing.title === hostname;
    const isCandidateFallback = candidate.title === hostname;
    const title = !isCandidateFallback ? candidate.title : !isExistingFallback ? existing.title : hostname;

    byUrl.set(normalizedUrl, { ...better, title });
  }

  const bookmarks = [...byUrl.values()];
  return {
    bookmarks,
    report: {
      totalChromeBookmarks: params.chromeBookmarks.length,
      matched,
      deduped: bookmarks.length
    }
  };
}

export function sortBookmarks(items: BookmarkItem[], key: BookmarkSortKey): BookmarkItem[] {
  const copy = [...items];
  if (key === "savedAtDesc") {
    copy.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  } else if (key === "savedAtAsc") {
    copy.sort((a, b) => Date.parse(a.savedAt) - Date.parse(b.savedAt));
  } else if (key === "titleAsc") {
    copy.sort((a, b) => a.title.localeCompare(b.title, "ja"));
  }
  return copy;
}

