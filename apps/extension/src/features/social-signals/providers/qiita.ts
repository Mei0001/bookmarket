import type { SocialSignal } from "@bookmarket/shared-kernel";
import { fetchWithTimeout, readTextSafe } from "../fetchUtils";
import { enforceProviderRateLimit } from "../rateLimit";

type QiitaItemResponse = {
  likes_count?: number;
  comments_count?: number;
  stocks_count?: number;
};

function extractQiitaItemId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname !== "qiita.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "items");
    if (idx === -1) return null;
    const itemId = parts[idx + 1];
    return itemId && itemId.length > 0 ? itemId : null;
  } catch {
    return null;
  }
}

export async function fetchQiitaSignal(url: string): Promise<Pick<SocialSignal, "likeCount" | "bookmarkCount" | "commentCount" | "fetchedFrom" | "ttlHours">> {
  const itemId = extractQiitaItemId(url);
  if (!itemId) {
    // Qiita 以外は「データなし」扱い
    return { fetchedFrom: "qiita", likeCount: null, bookmarkCount: null, commentCount: null, ttlHours: 24 };
  }

  await enforceProviderRateLimit("qiita");

  const endpoint = `https://qiita.com/api/v2/items/${encodeURIComponent(itemId)}`;
  const res = await fetchWithTimeout(endpoint, { timeoutMs: 2500, headers: { accept: "application/json" } });

  if (!res.ok) {
    const body = await readTextSafe(res);
    throw new Error(`Qiita API error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as QiitaItemResponse;
  const likeCount = Number.isFinite(data.likes_count) ? Math.max(0, Math.floor(data.likes_count ?? 0)) : null;
  const commentCount = Number.isFinite(data.comments_count) ? Math.max(0, Math.floor(data.comments_count ?? 0)) : null;
  const bookmarkCount = Number.isFinite(data.stocks_count) ? Math.max(0, Math.floor(data.stocks_count ?? 0)) : null;

  return {
    fetchedFrom: "qiita",
    likeCount,
    commentCount,
    bookmarkCount,
    ttlHours: 24
  };
}
