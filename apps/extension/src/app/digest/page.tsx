"use client";

import type { BookmarkItem, DigestSnapshot } from "@bookmarket/shared-kernel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generateDigest } from "@/lib/digest/generateDigest";
import { deleteBookmarks, getAllBookmarks, getRecentDigests, persistBookmarks } from "@/lib/storage/indexedDbClient";
import { fetchUrlBookmarks } from "@/lib/bookmarks/chromeBookmarksAdapter";
import { DigestShareButton } from "@/components/digest/DigestShareButton";
import { SheetExportButton } from "@/components/export/SheetExportButton";

function toIsoFromChrome(dateAdded?: number) {
  if (!dateAdded) return new Date().toISOString();
  return new Date(dateAdded).toISOString();
}

function toBookmarkItem(input: { id: string; title: string; url: string; dateAdded?: number; sourceRuleId?: string }): BookmarkItem {
  const now = new Date().toISOString();
  return {
    id: input.id,
    sourceRuleId: input.sourceRuleId ?? new URL(input.url).hostname,
    title: input.title || input.url,
    url: input.url,
    savedAt: toIsoFromChrome(input.dateAdded),
    status: "unread",
    tags: [],
    lastUpdatedAt: now
  };
}

function seedBookmarks(): BookmarkItem[] {
  const now = Date.now();
  const urls = [
    "https://qiita.com/",
    "https://note.com/",
    "https://b.hatena.ne.jp/",
    "https://x.com/elonmusk/status/20",
    "https://qiita.com/taichii/items/0b2f7b84e8b8b7f01a0f",
    "https://note.com/note_pr/n/n1f3a0d0a2f5b",
    "https://developer.mozilla.org/ja/docs/Web/API/Clipboard_API",
    "https://example.com/",
    "https://qiita.com/Qiita/items/c686397e4a0f4f11683d",
    "https://note.com/note_pr"
  ];

  return urls.map((url, i) =>
    toBookmarkItem({
      id: `seed-${i}`,
      title: `Seed ${i + 1}`,
      url,
      dateAdded: now - i * 60 * 60 * 1000
    })
  );
}

export default function DigestPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestSummary, setLatestSummary] = useState<string>("");
  const [latestDigest, setLatestDigest] = useState<DigestSnapshot | null>(null);
  const [latestTopItems, setLatestTopItems] = useState<
    Array<{ title: string; url: string; score: number; metrics: string; cached: boolean }>
  >([]);
  const [recentDigestTimes, setRecentDigestTimes] = useState<string[]>([]);

  const unreadCount = useMemo(() => bookmarks.filter((b) => b.status === "unread").length, [bookmarks]);
  const bookmarkById = useMemo(() => new Map(bookmarks.map((b) => [b.id, b])), [bookmarks]);

  const refresh = useCallback(async () => {
    const [all, digests] = await Promise.all([getAllBookmarks(), getRecentDigests(3)]);
    setBookmarks(all);
    setRecentDigestTimes(digests.map((d) => d.generatedAt));
    setLatestDigest(digests[0] ?? null);
    if (digests[0]?.summaryText) setLatestSummary(digests[0].summaryText);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSeed = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await persistBookmarks(seedBookmarks());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const onSyncChrome = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const chromeBookmarks = await fetchUrlBookmarks();
      const httpsOnly = chromeBookmarks.filter((b) => b.url.startsWith("https://"));
      const items = httpsOnly.map((b) =>
        toBookmarkItem({
          id: b.id,
          title: b.title,
          url: b.url,
          dateAdded: b.dateAdded,
          sourceRuleId: new URL(b.url).hostname
        })
      );
      await persistBookmarks(items);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const onClear = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await deleteBookmarks(bookmarks.map((b) => b.id));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [bookmarks, refresh]);

  const onGenerate = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { snapshot, topItems } = await generateDigest({ topN: 10, signalConcurrency: 3 });
      setLatestDigest(snapshot);
      setLatestTopItems(
        topItems.slice(0, 3).map((item) => {
          const sig = item.signal;
          const metrics = [
            sig?.bookmarkCount != null ? `bkm:${sig.bookmarkCount}` : null,
            sig?.likeCount != null ? `like:${sig.likeCount}` : null,
            sig?.commentCount != null ? `cmt:${sig.commentCount}` : null
          ]
            .filter(Boolean)
            .join(" ");
          return {
            title: item.bookmark.title,
            url: item.bookmark.url,
            score: item.score,
            metrics,
            cached: item.usedSignalCache
          };
        })
      );
      if (snapshot.summaryText) setLatestSummary(snapshot.summaryText);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-widest text-gray-500">US4</p>
        <h1 className="text-3xl font-semibold">朝のダイジェスト</h1>
        <p className="text-base text-gray-600">未確認ブックマークから優先度を算出し、共有コピーとSheetsエクスポートを行います。</p>
      </header>

      {error ? (
        <section className="rounded-2xl border border-warning/40 bg-white p-4 shadow-sm">
          <p className="text-sm text-warning">{error}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-gray-500">未確認</p>
          <p className="mt-1 text-3xl font-semibold">{unreadCount}</p>
          <p className="mt-2 text-sm text-gray-500">IndexedDB に保存された未確認件数</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-gray-500">直近ダイジェスト</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-surface-alt p-3">
              <p className="text-xs text-gray-500">新規(24h)</p>
              <p className="mt-1 text-lg font-semibold">{latestDigest?.newSinceYesterday ?? 0}</p>
            </div>
            <div className="rounded-xl bg-surface-alt p-3">
              <p className="text-xs text-gray-500">期限リマインド</p>
              <p className="mt-1 text-lg font-semibold">{latestDigest?.remindersDue ?? 0}</p>
            </div>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {recentDigestTimes.length ? (
              recentDigestTimes.map((t) => (
                <li key={t} className="font-mono text-xs">
                  {t}
                </li>
              ))
            ) : (
              <li className="text-gray-500">まだありません</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-gray-500">操作</p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={onGenerate}
              disabled={loading}
            >
              ダイジェスト生成
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
                onClick={onSeed}
                disabled={loading}
              >
                サンプル投入
              </button>
              <button
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
                onClick={onSyncChrome}
                disabled={loading}
              >
                Chrome同期
              </button>
            </div>
            <button
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
              onClick={onClear}
              disabled={loading || bookmarks.length === 0}
            >
              全削除
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium">優先度上位（Top 3）</h2>
        <p className="mt-1 text-sm text-gray-500">社会的指標（bkm/like/cmt）＋保存の新しさでスコア化しています。</p>
        <ul className="mt-4 space-y-3">
          {latestTopItems.length ? (
            latestTopItems.map((item) => (
              <li key={item.url} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    score: <span className="font-mono">{item.score.toFixed(2)}</span>
                    {item.metrics ? (
                      <>
                        {" "}
                        / <span className="font-mono">{item.metrics}</span>
                      </>
                    ) : null}
                    {item.cached ? " / cached" : null}
                  </p>
                </div>
                <a className="mt-2 block break-all font-mono text-xs text-accent" href={item.url} target="_blank" rel="noreferrer">
                  {item.url}
                </a>
              </li>
            ))
          ) : latestDigest?.priorityItems?.length ? (
            latestDigest.priorityItems.slice(0, 3).map((p) => {
              const b = bookmarkById.get(p.bookmarkId);
              return (
                <li key={p.bookmarkId} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm font-medium text-gray-900">{b?.title ?? p.bookmarkId}</p>
                    <p className="text-xs text-gray-500">
                      score: <span className="font-mono">{p.score.toFixed(2)}</span>
                    </p>
                  </div>
                  {b?.url ? (
                    <a className="mt-2 block break-all font-mono text-xs text-accent" href={b.url} target="_blank" rel="noreferrer">
                      {b.url}
                    </a>
                  ) : null}
                </li>
              );
            })
          ) : (
            <li className="text-sm text-gray-500">まだ生成されていません</li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-medium">共有用テキスト</h2>
            <p className="mt-1 text-sm text-gray-500">生成済みのダイジェスト要約をLINE等に貼り付ける想定です。</p>
          </div>
          <div className="flex gap-2">
            <DigestShareButton text={latestSummary} disabled={!latestSummary || loading} />
          </div>
        </div>

        <textarea
          className="mt-4 w-full rounded-xl border border-gray-200 bg-surface-alt p-3 font-mono text-xs text-gray-800"
          rows={10}
          value={latestSummary}
          readOnly
          placeholder="ダイジェスト生成後にここへ表示されます"
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium">Google Sheets エクスポート</h2>
        <p className="mt-1 text-sm text-gray-500">未確認/確認済みを含むブックマーク一覧をSheetsに書き出します（失敗時は再試行可能）。</p>

        <div className="mt-4">
          <SheetExportButton getBookmarks={() => getAllBookmarks()} disabled={loading} onFinished={refresh} />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium">データ（先頭20件）</h2>
        <ul className="mt-4 space-y-2">
          {bookmarks.slice(0, 20).map((b) => (
            <li key={b.id} className="rounded-xl border border-gray-100 p-3">
              <p className="text-sm font-medium text-gray-900">{b.title}</p>
              <p className="mt-1 break-all font-mono text-xs text-gray-600">{b.url}</p>
              <p className="mt-2 text-xs text-gray-500">
                status: <span className="font-mono">{b.status}</span> / savedAt: <span className="font-mono">{b.savedAt}</span>
              </p>
            </li>
          ))}
          {bookmarks.length === 0 ? <li className="text-sm text-gray-500">まだデータがありません</li> : null}
        </ul>
      </section>
    </main>
  );
}
