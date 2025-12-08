import type { BookmarkItem } from "@bookmarket/shared-kernel";

export interface BookmarkDiff {
  created: BookmarkItem[];
  updated: BookmarkItem[];
  removed: BookmarkItem[];
}

export function diffBookmarks(previous: BookmarkItem[], next: BookmarkItem[]): BookmarkDiff {
  const prevMap = new Map(previous.map((item) => [item.id, item]));
  const nextMap = new Map(next.map((item) => [item.id, item]));

  const created: BookmarkItem[] = [];
  const updated: BookmarkItem[] = [];
  const removed: BookmarkItem[] = [];

  for (const [id, current] of nextMap) {
    if (!prevMap.has(id)) {
      created.push(current);
      continue;
    }

    const prev = prevMap.get(id)!;
    if (JSON.stringify(prev) !== JSON.stringify(current)) {
      updated.push(current);
    }
  }

  for (const [id, item] of prevMap) {
    if (!nextMap.has(id)) {
      removed.push(item);
    }
  }

  return { created, updated, removed };
}

export function hashBookmarks(items: BookmarkItem[]) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(items.map((item) => item.id).join(":")));
}

