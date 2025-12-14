import type { BookmarkItem, DigestSnapshot, ReviewReminder, SocialSignal } from "@bookmarket/shared-kernel";
import { rankBookmarksByPriority } from "@bookmarket/shared-kernel";
import { getAllBookmarks, getAllReminders, persistDigestSnapshot } from "@/lib/storage/indexedDbClient";
import { getOrFetchSocialSignal } from "@/features/social-signals/socialSignalService";

function safeRandomId(prefix: string) {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${rnd}`;
}

function withinLastHours(iso: string, now: Date, hours: number) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t <= hours * 60 * 60 * 1000;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const current = idx;
      idx += 1;
      results[current] = await fn(items[current]);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

export type GeneratedDigest = {
  snapshot: DigestSnapshot;
  topItems: Array<{ bookmark: BookmarkItem; score: number; signal: SocialSignal | null; reminder: ReviewReminder | null; usedSignalCache: boolean }>;
};

export async function generateDigest(options?: { scheduledFor?: Date; topN?: number; signalConcurrency?: number }): Promise<GeneratedDigest> {
  const now = options?.scheduledFor ?? new Date();
  const topN = options?.topN ?? 10;
  const signalConcurrency = options?.signalConcurrency ?? 3;

  const [bookmarks, reminders] = await Promise.all([getAllBookmarks(), getAllReminders()]);

  const unread = bookmarks.filter((b) => b.status === "unread");
  const remindersDue = reminders.filter((r) => r.status === "scheduled" && Date.parse(r.scheduledFor) <= now.getTime());

  const bookmarkById = new Map<string, BookmarkItem>(unread.map((b) => [b.id, b]));

  const reminderByBookmarkId = new Map<string, ReviewReminder>();
  for (const r of reminders) {
    if (!reminderByBookmarkId.has(r.bookmarkId)) reminderByBookmarkId.set(r.bookmarkId, r);
  }

  // Social signal は外部APIが不安定なので、少数並列 + TTLキャッシュ前提
  const signals = await mapWithConcurrency(unread, signalConcurrency, async (b) => {
    const result = await getOrFetchSocialSignal({ id: b.id, url: b.url });
    return { bookmarkId: b.id, ...result };
  });
  const signalByBookmarkId = new Map<string, { signal: SocialSignal | null; usedCache: boolean }>();
  for (const s of signals) signalByBookmarkId.set(s.bookmarkId, { signal: s.signal, usedCache: s.usedCache });

  const ranked = rankBookmarksByPriority(
    unread.map((bookmark) => ({
      bookmark,
      socialSignal: signalByBookmarkId.get(bookmark.id)?.signal ?? null,
      reminder: reminderByBookmarkId.get(bookmark.id) ?? null
    })),
    now
  ).slice(0, topN);

  const topItems = ranked.map((r) => {
    const bookmark = bookmarkById.get(r.bookmarkId) as BookmarkItem;
    const signalInfo = signalByBookmarkId.get(r.bookmarkId);
    return {
      bookmark,
      score: r.score,
      signal: signalInfo?.signal ?? null,
      reminder: reminderByBookmarkId.get(r.bookmarkId) ?? null,
      usedSignalCache: signalInfo?.usedCache ?? false
    };
  });

  const newSinceYesterday = unread.filter((b) => withinLastHours(b.savedAt, now, 24)).length;

  const summaryLines = topItems.slice(0, 3).map((item, i) => {
    const sig = item.signal;
    const metrics = [
      sig?.bookmarkCount != null ? `bkm:${sig.bookmarkCount}` : null,
      sig?.likeCount != null ? `like:${sig.likeCount}` : null,
      sig?.commentCount != null ? `cmt:${sig.commentCount}` : null
    ]
      .filter(Boolean)
      .join(" ");
    const metricsText = metrics ? ` (${metrics}${item.usedSignalCache ? " cached" : ""})` : item.usedSignalCache ? " (cached)" : "";
    return `${i + 1}. ${item.bookmark.title}${metricsText}\n${item.bookmark.url}`;
  });

  const summaryText = `【Bookmarket 今日のダイジェスト】\n未確認: ${unread.length} / 新規(24h): ${newSinceYesterday} / リマインダー期限: ${remindersDue.length}\n\n優先度上位\n${summaryLines.join("\n\n")}`;

  const snapshot: DigestSnapshot = {
    id: safeRandomId("digest"),
    generatedAt: now.toISOString(),
    unreadCount: unread.length,
    priorityItems: ranked.map((r) => ({ bookmarkId: r.bookmarkId, score: r.score })),
    newSinceYesterday,
    remindersDue: remindersDue.length,
    summaryText
  };

  await persistDigestSnapshot(snapshot);

  return { snapshot, topItems };
}
