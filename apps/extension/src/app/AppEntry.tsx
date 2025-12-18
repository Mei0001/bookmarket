"use client";

import { useEffect, useMemo, useState } from "react";
import type { ButtonHTMLAttributes, FormEvent, InputHTMLAttributes } from "react";
import type { SourceRuleCreate } from "@bookmarket/shared-kernel";
import { SourceRuleTypeSchema } from "@bookmarket/shared-kernel";
import Link from "next/link";
import { useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { BookmarkList } from "@/components/bookmarks/BookmarkList";
import { EmptyState } from "@/components/bookmarks/EmptyState";
import { useSourceRules } from "@/features/sources/sourceRuleStore";
import { syncBookmarksNow } from "@/lib/bookmarks/syncScheduler";
import { getAllBookmarks, getLocalValue, LocalStorageKeys } from "@/lib/storage/indexedDbClient";
import type { BookmarkItem } from "@bookmarket/shared-kernel";

type Mode = "dashboard" | "popup" | "options";

function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "rounded-lg px-3 py-2 text-sm font-semibold",
        "bg-[color:var(--accent)] text-white",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        props.className ?? ""
      ].join(" ")}
    />
  );
}

function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "rounded-lg px-3 py-2 text-sm font-semibold",
        "border border-[color:var(--border)] bg-transparent",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        props.className ?? ""
      ].join(" ")}
    />
  );
}

function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-lg border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]",
        props.className ?? ""
      ].join(" ")}
    />
  );
}

function DashboardView() {
  const steps = [
    "Register the blogs / handles you want to follow",
    "Sync recent bookmarks from Chrome",
    "Tag unread items and queue reminders"
  ] as const;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-widest text-gray-500">Preview</p>
        <h1 className="text-3xl font-semibold">Bookmarket Aggregator</h1>
        <p className="text-base text-gray-600">
          The UI will eventually mount inside the Chrome extension popup. For now we expose a dashboard shell so the design system
          can be iterated in the browser while core data services are being built.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium">Coming Up Next</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-gray-700">
          {steps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-gray-500">
          Use <code>pnpm dev</code> to view this page and reload automatically while implementing each user story.
        </p>
      </section>
    </main>
  );
}

function OptionsView() {
  const { rules, create, remove, loaded } = useSourceRules();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<SourceRuleCreate["type"]>("domain");
  const [pattern, setPattern] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const typeOptions = useMemo(() => SourceRuleTypeSchema.options, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await create({
        label,
        type,
        pattern,
        colorHex: colorHex.trim().length ? colorHex.trim() : undefined
      });
      setLabel("");
      setPattern("");
      setColorHex("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create SourceRule");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">対象サイト設定</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">登録したドメインに一致するブックマークだけをpopupで表示します。</p>
        </div>
        <Link className="text-sm underline" href="/?popup=1">
          popupを開く →
        </Link>
      </header>

      <section className="card-surface p-5">
        <h2 className="text-lg font-semibold">追加</h2>

        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">ラベル</label>
            <TextField value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Qiita / Note など" required />
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">種別</label>
            <select
              className="w-full rounded-lg border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as SourceRuleCreate["type"])}
            >
              {typeOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              パターン（domainは例: <code>qiita.com</code>）
            </label>
            <TextField value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="qiita.com" required />
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">カラー（任意 / #RRGGBB）</label>
            <TextField value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#0EA5E9" />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={busy}>
              追加
            </PrimaryButton>
            <Link
              href="/?popup=1"
              className="rounded-lg px-3 py-2 text-sm font-semibold border border-[color:var(--border)] bg-transparent"
            >
              popupへ
            </Link>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">登録済み</h2>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {loaded ? `${rules.length}件` : "読み込み中…"}
          </span>
        </div>

        {rules.length === 0 ? (
          <EmptyState title="まだ対象サイトがありません" description="まずは domain ルールを1件追加してください（例: qiita.com）。" />
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="card-surface p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: rule.colorHex, border: `1px solid ${rule.colorHex}55` }}
                      aria-hidden
                    />
                    <p className="font-semibold truncate">{rule.label}</p>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{rule.type}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    <code>{rule.pattern}</code>
                  </p>
                </div>
                <SecondaryButton type="button" onClick={() => void remove(rule.id)}>
                  削除
                </SecondaryButton>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PopupView() {
  const { rules } = useSourceRules();
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => getLocalValue<string>(LocalStorageKeys.lastSyncAt));

  async function loadFromDb() {
    try {
      const existing = await getAllBookmarks();
      setItems(existing.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookmarks");
    }
  }

  useEffect(() => {
    void (async () => {
      await loadFromDb();
    })();
  }, []); // 初回のみDBから読み込み

  async function onSync() {
    setBusy(true);
    setError(null);
    try {
      const result = await syncBookmarksNow(rules);
      setItems(result.items);
      setLastSyncAt(result.lastSyncAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Bookmarket</h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            対象: {rules.length}件 / 最終同期: {lastSyncAt ?? "未実施"}
          </p>
        </div>
        <Link className="text-xs underline" href="/?options=1">
          設定 →
        </Link>
      </header>

      <div className="flex gap-2">
        <PrimaryButton onClick={() => void onSync()} disabled={busy || rules.length === 0}>
          {busy ? "同期中…" : "今すぐ同期"}
        </PrimaryButton>
        <SecondaryButton onClick={() => void loadFromDb()} disabled={busy}>
          再読込
        </SecondaryButton>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {rules.length === 0 ? (
        <EmptyState
          title="対象サイトが未登録です"
          description="先にoptionsでドメインを登録してください（例: qiita.com）。"
          actions={
            <Link
              className="rounded-lg px-3 py-2 text-sm font-semibold border border-[color:var(--border)]"
              href="/?options=1"
            >
              設定を開く
            </Link>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="対象ブックマークがありません"
          description="対象ドメインの記事をブックマークしてから「今すぐ同期」を押してください。"
        />
      ) : (
        <BookmarkList items={items} sourceRules={rules} />
      )}
    </main>
  );
}

function modeFromSearchParams(searchParams: ReadonlyURLSearchParams | null): Mode {
  if (!searchParams) return "dashboard";
  if (searchParams.has("popup")) return "popup";
  if (searchParams.has("options")) return "options";
  return "dashboard";
}

export default function AppEntry() {
  const searchParams = useSearchParams();
  const mode = modeFromSearchParams(searchParams);
  if (mode === "popup") return <PopupView />;
  if (mode === "options") return <OptionsView />;
  return <DashboardView />;
}

