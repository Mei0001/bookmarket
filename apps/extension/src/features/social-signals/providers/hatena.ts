import type { SocialSignal } from "@bookmarket/shared-kernel";
import { fetchWithTimeout, readTextSafe } from "../fetchUtils";
import { enforceProviderRateLimit } from "../rateLimit";

export async function fetchHatenaSignal(url: string): Promise<Pick<SocialSignal, "likeCount" | "bookmarkCount" | "commentCount" | "fetchedFrom" | "ttlHours">> {
  await enforceProviderRateLimit("hatena");

  // Hatena Bookmark count (public)
  const endpoint = `https://bookmark.hatenaapis.com/count/entry?url=${encodeURIComponent(url)}`;
  const res = await fetchWithTimeout(endpoint, { timeoutMs: 2000, headers: { accept: "text/plain" } });

  if (!res.ok) {
    const body = await readTextSafe(res);
    throw new Error(`Hatena API error: ${res.status} ${body}`);
  }

  const raw = (await readTextSafe(res)).trim();
  const count = raw.length ? Number(raw) : 0;
  const bookmarkCount = Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;

  return {
    fetchedFrom: "hatena",
    bookmarkCount,
    likeCount: null,
    commentCount: null,
    ttlHours: 24
  };
}
