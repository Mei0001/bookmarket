import type { BookmarkItem } from "@bookmarket/shared-kernel";

export interface DiffResult<T> {
  created: T[];
  updated: T[];
  removed: T[];
}

export type BookmarkDiff = DiffResult<BookmarkItem>;

function stableStringify(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number" || t === "boolean" || t === "bigint") return String(value);
  if (t === "symbol") return `symbol:${String(value)}`;
  if (t === "function") {
    const name = (value as { name?: string }).name;
    return `function:${name || "anonymous"}`;
  }

  if (value instanceof Date) return `date:${value.toISOString()}`;

  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v, seen)).join(",")}]`;
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) throw new Error("stableStringify: circular reference detected");
    seen.add(obj);

    const keys = Object.keys(obj).sort();
    const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k], seen)}`);
    return `{${entries.join(",")}}`;
  }

  return String(value);
}

export function stableDeepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

export function diffById<T extends { id: string }>(
  previous: T[],
  next: T[],
  options?: { equals?: (a: T, b: T) => boolean }
): DiffResult<T> {
  const equals = options?.equals ?? stableDeepEqual;

  const prevMap = new Map(previous.map((item) => [item.id, item]));
  const nextMap = new Map(next.map((item) => [item.id, item]));

  const created: T[] = [];
  const updated: T[] = [];
  const removed: T[] = [];

  for (const [id, current] of nextMap) {
    const prev = prevMap.get(id);
    if (!prev) {
      created.push(current);
      continue;
    }
    if (!equals(prev, current)) {
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

export function diffBookmarks(
  previous: BookmarkItem[],
  next: BookmarkItem[],
  options?: { equals?: (a: BookmarkItem, b: BookmarkItem) => boolean }
): BookmarkDiff {
  return diffById(previous, next, options);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export async function hashBookmarkIds(items: Array<{ id: string }>): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is not available (crypto.subtle).");
  }
  const input = items.map((item) => item.id).join(":");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return arrayBufferToHex(digest);
}

export async function hashBookmarks(items: BookmarkItem[]): Promise<string> {
  return hashBookmarkIds(items);
}


