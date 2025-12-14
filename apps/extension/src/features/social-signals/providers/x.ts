import type { SocialSignal } from "@bookmarket/shared-kernel";
import { fetchWithTimeout, readTextSafe } from "../fetchUtils";
import { enforceProviderRateLimit } from "../rateLimit";

type XWidgetTweet = {
  favorite_count?: number;
  conversation_count?: number;
  quote_count?: number;
  retweet_count?: number;
};

function extractTweetId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname !== "x.com" && u.hostname !== "twitter.com" && u.hostname !== "www.twitter.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const statusIdx = parts.findIndex((p) => p === "status");
    if (statusIdx === -1) return null;
    const id = parts[statusIdx + 1];
    return id && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export async function fetchXSignal(url: string): Promise<Pick<SocialSignal, "likeCount" | "bookmarkCount" | "commentCount" | "fetchedFrom" | "ttlHours">> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    return { fetchedFrom: "x", likeCount: null, bookmarkCount: null, commentCount: null, ttlHours: 24 };
  }

  await enforceProviderRateLimit("x");

  // Public-ish endpoint used by embeds
  const endpoint = `https://cdn.syndication.twimg.com/widgets/tweet?id=${encodeURIComponent(tweetId)}`;
  const res = await fetchWithTimeout(endpoint, { timeoutMs: 2500, headers: { accept: "application/json" } });

  if (!res.ok) {
    const body = await readTextSafe(res);
    throw new Error(`X widget API error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as XWidgetTweet;

  const likeCount = Number.isFinite(data.favorite_count) ? Math.max(0, Math.floor(data.favorite_count ?? 0)) : null;
  // コメント相当: 返信 + 引用を合算
  const commentCountRaw = (Number.isFinite(data.conversation_count) ? (data.conversation_count ?? 0) : 0) +
    (Number.isFinite(data.quote_count) ? (data.quote_count ?? 0) : 0);
  const commentCount = Number.isFinite(commentCountRaw) ? Math.max(0, Math.floor(commentCountRaw)) : null;

  return {
    fetchedFrom: "x",
    likeCount,
    commentCount,
    bookmarkCount: null,
    ttlHours: 24
  };
}
