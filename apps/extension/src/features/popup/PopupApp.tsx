"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { BookmarkItem, SourceRule } from "@bookmarket/shared-kernel";

import { getAllBookmarks } from "@/lib/storage/indexedDbClient";
import { listSourceRules } from "@/lib/sourceRules/sourceRuleRepository";
import { sortBookmarks, type BookmarkSortKey } from "@/lib/sync/bookmarkSync";
import { syncBookmarksFromChrome } from "@/lib/sync/runBookmarkSync";
import { useExtensionAuth } from "@/lib/auth/useExtensionAuth";

function openUrl(url: string) {
  try {
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url });
      return;
    }
  } catch {
    // ignore
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ja-JP");
}

export function PopupApp() {
  const auth = useExtensionAuth();
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [rules, setRules] = useState<SourceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sortKey, setSortKey] = useState<BookmarkSortKey>("savedAtDesc");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ruleById = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookmarks, sourceRules] = await Promise.all([getAllBookmarks(), listSourceRules()]);
      const ruleIds = new Set(sourceRules.map((r) => r.id));
      setItems(bookmarks.filter((b) => ruleIds.has(b.sourceRuleId)));
      setRules(sourceRules);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sorted = useMemo(() => sortBookmarks(items, sortKey), [items, sortKey]);

  const onSync = useCallback(async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const report = await syncBookmarksFromChrome({ userId: auth.userId });
      await reload();
      setMessage(`同期完了: matched=${report.matched}, deduped=${report.deduped}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  }, [auth.userId, reload]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-gray-500">Popup</p>
            <h1 className="text-3xl font-semibold">ブックマーク一覧</h1>
          </div>
          <div className="flex gap-2">
            {auth.profile ? (
              <button
                type="button"
                className="rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
                onClick={() => void auth.actions.restoreFromRemote()}
                disabled={!auth.token || !!auth.busy}
                title="サーバーの設定/ブックマークを復元"
              >
                復元
              </button>
            ) : (
              <button
                type="button"
                className="rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
                onClick={() => void auth.actions.signIn()}
                disabled={!!auth.busy || !auth.canInteractiveSignIn}
                title={auth.canInteractiveSignIn ? "Googleでサインイン" : "拡張機能として実行してください"}
              >
                Login
              </button>
            )}
            <button
              type="button"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={onSync}
              disabled={syncing}
            >
              {syncing ? "同期中..." : "再同期"}
            </button>
            <Link
              href="/?options=1"
              className="rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-medium hover:bg-surface"
            >
              Options
            </Link>
          </div>
        </div>
        <p className="text-sm text-gray-600">対象ドメインのみを抽出し、URL重複を排除した一覧です。</p>
        {auth.profile ? <p className="text-xs text-gray-500">Signed in: {auth.profile.email}</p> : null}
        {auth.busy ? <p className="text-sm text-blue-700">{auth.busy}</p> : null}
        {auth.error ? <p className="text-sm text-orange-600">{auth.error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-orange-600">{error}</p> : null}
      </header>

      <section className="card-surface p-6 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-medium">Items</h2>
            {loading ? <span className="text-sm text-gray-500">読み込み中...</span> : <span className="text-sm text-gray-600">{items.length} 件</span>}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">並び替え</label>
            <select
              className="rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as BookmarkSortKey)}
            >
              <option value="savedAtDesc">新しい順</option>
              <option value="savedAtAsc">古い順</option>
              <option value="titleAsc">タイトル順</option>
            </select>
          </div>
        </div>

        {!loading && sorted.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-surface-alt p-6 text-center">
            <p className="text-sm text-gray-700">表示するブックマークがありません。</p>
            <p className="mt-1 text-xs text-gray-600">Optionsでドメインを追加し、同期してください。</p>
          </div>
        ) : null}

        <ul className="mt-4 divide-y divide-border">
          {sorted.map((item) => {
            const rule = ruleById.get(item.sourceRuleId);
            return (
              <li key={item.id} className="py-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="text-left text-sm font-medium text-foreground hover:underline"
                      onClick={() => openUrl(item.url)}
                    >
                      {item.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      {rule ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rule.colorHex }} />
                          <span>{rule.label}</span>
                        </span>
                      ) : null}
                      <span className="truncate">{item.url}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 sm:text-right">
                    <div>保存: {formatDate(item.savedAt)}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

