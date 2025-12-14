import type { BookmarkItem, SocialSignal } from "@bookmarket/shared-kernel";
import { persistSocialSignal, getSocialSignal } from "@/lib/storage/indexedDbClient";
import { detectProvider, fetchSignalByProvider } from "./providers";

function createSignalId(bookmarkId: string, fetchedFrom: SocialSignal["fetchedFrom"]) {
  return `signal:${fetchedFrom}:${bookmarkId}`;
}

function isExpired(signal: SocialSignal, now = Date.now()) {
  const fetchedAt = Date.parse(signal.fetchedAt);
  if (!Number.isFinite(fetchedAt)) return true;
  const ttlMs = (signal.ttlHours ?? 24) * 60 * 60 * 1000;
  return fetchedAt + ttlMs <= now;
}

export type SocialSignalResult = {
  signal: SocialSignal | null;
  usedCache: boolean;
};

/**
 * - TTL内はIndexedDBキャッシュを返す
 * - 失敗時はキャッシュがあればそれを返す（FR/EdgeCase準拠）
 */
export async function getOrFetchSocialSignal(bookmark: Pick<BookmarkItem, "id" | "url">): Promise<SocialSignalResult> {
  const provider = detectProvider(bookmark.url);
  const id = createSignalId(bookmark.id, provider);

  const cached = await getSocialSignal(id);
  if (cached && !isExpired(cached)) {
    return { signal: cached, usedCache: true };
  }

  try {
    const partial = await fetchSignalByProvider(provider, bookmark.url);
    const signal: SocialSignal = {
      id,
      bookmarkId: bookmark.id,
      fetchedAt: new Date().toISOString(),
      fetchedFrom: partial.fetchedFrom,
      likeCount: partial.likeCount ?? null,
      bookmarkCount: partial.bookmarkCount ?? null,
      commentCount: partial.commentCount ?? null,
      ttlHours: partial.ttlHours ?? 24
    };
    await persistSocialSignal(signal);
    return { signal, usedCache: false };
  } catch (error) {
    // 失敗時はキャッシュがあればそれを使う
    if (cached) {
      return { signal: cached, usedCache: true };
    }
    console.warn("Failed to fetch social signal", { bookmarkId: bookmark.id, provider, error });
    return { signal: null, usedCache: false };
  }
}
