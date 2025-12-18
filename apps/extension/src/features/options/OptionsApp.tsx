"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { SourceRule } from "@bookmarket/shared-kernel";

import { createSourceRule, deleteSourceRule, listSourceRules, updateSourceRule } from "@/lib/sourceRules/sourceRuleRepository";
import { syncBookmarksFromChrome } from "@/lib/sync/runBookmarkSync";
import { useExtensionAuth } from "@/lib/auth/useExtensionAuth";

type CreateForm = {
  label: string;
  domain: string;
  colorHex: string;
};

function formatDate(value: string | null) {
  if (!value) return "未同期";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ja-JP");
}

function RuleRow(props: {
  rule: SourceRule;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const { rule, onUpdated, onDeleted } = props;

  const [label, setLabel] = useState(rule.label);
  const [pattern, setPattern] = useState(rule.pattern);
  const [colorHex, setColorHex] = useState(rule.colorHex);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = label !== rule.label || pattern !== rule.pattern || colorHex !== rule.colorHex;

  const save = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await updateSourceRule(rule.id, { label, pattern, colorHex });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }, [colorHex, label, onUpdated, pattern, rule.id]);

  const remove = useCallback(async () => {
    if (!confirm(`「${rule.label}」を削除しますか？`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSourceRule(rule.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }, [onDeleted, rule.id, rule.label]);

  return (
    <div className="card-surface p-4 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500">ラベル</label>
          <input
            className="mt-1 w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500">ドメイン</label>
          <input
            className="mt-1 w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            disabled={busy}
            placeholder="example.com"
          />
        </div>
        <div className="w-36">
          <label className="text-xs font-medium text-gray-500">色</label>
          <input
            className="mt-1 w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
            disabled={busy}
            placeholder="#2563eb"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={save}
            disabled={busy || !dirty}
          >
            保存
          </button>
          <button
            type="button"
            className="rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={remove}
            disabled={busy}
          >
            削除
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rule.colorHex }} />
          <span>{rule.type}</span>
        </span>
        <span>状態: {rule.syncStatus}</span>
        <span>最終同期: {formatDate(rule.lastSyncedAt)}</span>
        {rule.errorMessage ? <span className="text-orange-600">エラー: {rule.errorMessage}</span> : null}
      </div>

      {error ? <p className="mt-2 text-sm text-orange-600">{error}</p> : null}
    </div>
  );
}

export function OptionsApp() {
  const auth = useExtensionAuth();
  const [rules, setRules] = useState<SourceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateForm>({ label: "", domain: "", colorHex: "#2563eb" });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listSourceRules();
      setRules(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canCreate = useMemo(() => form.label.trim().length > 0 && form.domain.trim().length > 0, [form.domain, form.label]);

  const onCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canCreate) return;
      setMessage(null);
      setError(null);
      try {
        await createSourceRule(
          { label: form.label.trim(), type: "domain", pattern: form.domain.trim(), colorHex: form.colorHex.trim() },
          { userId: auth.userId }
        );
        setForm({ label: "", domain: "", colorHex: form.colorHex || "#2563eb" });
        await reload();
        setMessage("SourceRule を追加しました。");
      } catch (err) {
        setError(err instanceof Error ? err.message : "追加に失敗しました");
      }
    },
    [auth.userId, canCreate, form.colorHex, form.domain, form.label, reload]
  );

  const onSync = useCallback(async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const report = await syncBookmarksFromChrome({ userId: auth.userId });
      await reload();
      setMessage(`同期完了: matched=${report.matched}, deduped=${report.deduped}, persisted=${report.persisted}, removed=${report.removed}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  }, [auth.userId, reload]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-gray-500">Options</p>
            <h1 className="text-3xl font-semibold">SourceRule 管理</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {auth.profile ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-alt px-3 py-2">
                <span className="text-xs text-gray-600">Signed in:</span>
                <span className="max-w-[180px] truncate text-sm font-medium">{auth.profile.displayName}</span>
                <button
                  type="button"
                  className="rounded-lg border border-border bg-white px-2 py-1 text-xs font-medium hover:bg-surface"
                  onClick={() => void auth.actions.signOut()}
                  disabled={!!auth.busy}
                >
                  サインアウト
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => void auth.actions.signIn()}
                disabled={!!auth.busy || !auth.canInteractiveSignIn}
                title={auth.canInteractiveSignIn ? "Googleでサインイン" : "拡張機能として実行してください"}
              >
                Googleでサインイン
              </button>
            )}

            <button
              type="button"
              className="rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
              onClick={() => void auth.actions.pushToRemote()}
              disabled={!auth.token || !!auth.busy}
            >
              同期（保存）
            </button>
            <button
              type="button"
              className="rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
              onClick={() => void auth.actions.restoreFromRemote()}
              disabled={!auth.token || !!auth.busy}
            >
              復元
            </button>

            <Link href="/" className="rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-medium hover:bg-surface">
              Home に戻る
            </Link>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          対象ドメインを登録し、「同期する」で Chrome ブックマークから抽出・重複排除して保存します。
        </p>
        {auth.busy ? <p className="text-sm text-blue-700">{auth.busy}</p> : null}
        {auth.error ? <p className="text-sm text-orange-600">{auth.error}</p> : null}
      </header>

      <section className="card-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-medium">同期</h2>
          <button
            type="button"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={onSync}
            disabled={syncing}
          >
            {syncing ? "同期中..." : "同期する"}
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          注意: dev preview（ブラウザの通常ページ）では `chrome.bookmarks` が無いため同期はエラーになります。拡張として実行してください。
        </p>
        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-orange-600">{error}</p> : null}
      </section>

      <section className="card-surface p-6 shadow-card">
        <h2 className="text-xl font-medium">追加</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={onCreate}>
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-gray-500">ラベル</label>
            <input
              className="mt-1 w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
              value={form.label}
              onChange={(e) => setForm((v) => ({ ...v, label: e.target.value }))}
              placeholder="Qiita"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500">ドメイン</label>
            <input
              className="mt-1 w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
              value={form.domain}
              onChange={(e) => setForm((v) => ({ ...v, domain: e.target.value }))}
              placeholder="qiita.com"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-gray-500">色</label>
            <input
              className="mt-1 w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
              value={form.colorHex}
              onChange={(e) => setForm((v) => ({ ...v, colorHex: e.target.value }))}
              placeholder="#2563eb"
            />
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={!canCreate}
            >
              追加する
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">登録済み</h2>
          {loading ? <span className="text-sm text-gray-500">読み込み中...</span> : null}
        </div>

        {!loading && rules.length === 0 ? (
          <div className="card-surface p-6 shadow-card">
            <p className="text-sm text-gray-700">まだ SourceRule がありません。上のフォームから追加してください。</p>
          </div>
        ) : null}

        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} onUpdated={reload} onDeleted={reload} />
        ))}
      </section>
    </main>
  );
}

