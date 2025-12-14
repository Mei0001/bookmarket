"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SourceRule, UserSettings } from "@bookmarket/shared-kernel";
import { SourceRuleSchema, UserSettingsSchema } from "@bookmarket/shared-kernel";
import { OptionsApp } from "@/features/options/OptionsApp";
import { PopupApp } from "@/features/popup/PopupApp";
import { clearAuthSession, loadAuthSession, saveAuthSession } from "@/lib/auth/authStore";
import { signInWithGoogleViaLaunchWebAuthFlow } from "@/lib/auth/googleSignIn";
import {
  getAllBookmarks,
  getAllSourceRules,
  getUserSettings,
  overwriteAllBookmarks,
  overwriteAllSourceRules,
  persistUserSettings,
} from "@/lib/storage/indexedDbClient";
import { fetchRemoteState, pushRemoteState } from "@/lib/sync/syncClient";

function isExtensionRuntime() {
  return typeof chrome !== "undefined" && !!chrome.runtime?.id;
}

function defaultSettings(): UserSettings {
  return UserSettingsSchema.parse({});
}

function newSourceRule(params: { userId: string; type: "domain" | "handle"; label: string; pattern: string; colorHex: string }): SourceRule {
  return SourceRuleSchema.parse({
    id: crypto.randomUUID(),
    userId: params.userId,
    label: params.label,
    type: params.type,
    pattern: params.pattern,
    colorHex: params.colorHex,
    syncStatus: "idle",
    lastSyncedAt: null,
    errorMessage: null,
  });
}

function SyncHome() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof loadAuthSession>>>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [sourceRules, setSourceRules] = useState<SourceRule[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings());

  const userId = session?.profile.userId ?? "local";

  const syncBaseUrl = useMemo(() => process.env.NEXT_PUBLIC_SYNC_BASE_URL ?? "http://localhost:3001", []);

  async function refreshLocalState() {
    const [rules, storedSettings] = await Promise.all([getAllSourceRules(), getUserSettings()]);
    setSourceRules(rules);
    setSettings(UserSettingsSchema.parse(storedSettings ?? {}));
  }

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await loadAuthSession();
        setSession(loaded);
        await refreshLocalState();
        // 既存トークンがあれば自動復元（最小）
        if (loaded?.token) {
          try {
            setBusy("復元中…");
            const remote = await fetchRemoteState(loaded.token);
            await overwriteAllSourceRules(remote.sourceRules);
            await persistUserSettings(remote.settings);
            await overwriteAllBookmarks(remote.bookmarks);
            await refreshLocalState();
          } finally {
            setBusy(null);
          }
        }
      } catch (e) {
        console.error(e);
        setError(String(e));
      }
    })();
  }, []);

  async function handleSignIn() {
    setError(null);
    setBusy("サインイン中…");
    try {
      const result = await signInWithGoogleViaLaunchWebAuthFlow({ syncBaseUrl });
      await saveAuthSession(result);
      const loaded = await loadAuthSession();
      setSession(loaded);

      // サインイン直後に復元（サーバーに保存があれば）
      if (loaded?.token) {
        try {
          const remote = await fetchRemoteState(loaded.token);
          await overwriteAllSourceRules(remote.sourceRules);
          await persistUserSettings(remote.settings);
          await overwriteAllBookmarks(remote.bookmarks);
        } catch (e) {
          // 初回は 404 あり得る
          console.warn("[sync] restore skipped", e);
        }
      }
      await refreshLocalState();
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleSignOut() {
    setError(null);
    setBusy("サインアウト中…");
    try {
      await clearAuthSession();
      setSession(null);
    } finally {
      setBusy(null);
    }
  }

  async function handleSyncPush() {
    setError(null);
    if (!session?.token) {
      setError("未ログインのため同期できません。");
      return;
    }
    setBusy("同期中…");
    try {
      const [rules, currentSettings, bookmarks] = await Promise.all([getAllSourceRules(), getUserSettings(), getAllBookmarks()]);
      const body = {
        settings: UserSettingsSchema.parse(currentSettings ?? {}),
        sourceRules: rules,
        bookmarks,
      };
      await pushRemoteState(session.token, body);
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleSyncRestore() {
    setError(null);
    if (!session?.token) {
      setError("未ログインのため復元できません。");
      return;
    }
    setBusy("復元中…");
    try {
      const remote = await fetchRemoteState(session.token);
      await overwriteAllSourceRules(remote.sourceRules);
      await persistUserSettings(remote.settings);
      await overwriteAllBookmarks(remote.bookmarks);
      await refreshLocalState();
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleAddRule(form: HTMLFormElement) {
    setError(null);
    const formData = new FormData(form);
    try {
      const type = (formData.get("type") as "domain" | "handle") ?? "domain";
      const label = String(formData.get("label") ?? "").trim();
      const pattern = String(formData.get("pattern") ?? "").trim();
      const colorHex = String(formData.get("colorHex") ?? "#3b82f6").trim();

      const rule = newSourceRule({ userId, type, label, pattern, colorHex });
      await overwriteAllSourceRules([...sourceRules, rule]);
      await refreshLocalState();
      form.reset();
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function handleDeleteRule(id: string) {
    setError(null);
    try {
      await overwriteAllSourceRules(sourceRules.filter((r) => r.id !== id));
      await refreshLocalState();
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function handleUpdateSettings(next: Partial<UserSettings>) {
    setError(null);
    try {
      const merged = UserSettingsSchema.parse({ ...settings, ...next });
      await persistUserSettings(merged);
      await refreshLocalState();
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-widest text-gray-500">US2</p>
          <h1 className="text-3xl font-semibold">Googleログイン / 同期</h1>
          <p className="text-base text-gray-600">
            {isExtensionRuntime()
              ? "拡張機能として動作中です。サインインして設定を同期できます。"
              : "拡張機能環境ではないため、サインインは動きません（UI確認用）。"}
          </p>
        </div>

        <div className="min-w-[260px] rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          {session ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-100">
                  {session.profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={session.profile.avatarUrl} alt="" className="h-10 w-10 object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{session.profile.displayName}</div>
                  <div className="truncate text-sm text-gray-600">{session.profile.email}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSyncPush}
                  disabled={!!busy}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  同期（保存）
                </button>
                <button
                  type="button"
                  onClick={handleSyncRestore}
                  disabled={!!busy}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  復元
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={!!busy}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  サインアウト
                </button>
              </div>
              <div className="text-xs text-gray-500">
                Sync: <code className="break-all">{syncBaseUrl}</code>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">未ログイン</div>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={!!busy || !isExtensionRuntime()}
                className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Googleでサインイン
              </button>
              <div className="text-xs text-gray-500">
                Sync: <code className="break-all">{syncBaseUrl}</code>
              </div>
            </div>
          )}
        </div>
      </header>

      {busy ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{busy}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium">ユーザー設定</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="space-y-1">
            <div className="text-sm text-gray-700">Digest time</div>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={settings.digestTime}
              onChange={(e) => void handleUpdateSettings({ digestTime: e.target.value })}
              placeholder="07:00"
            />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-700">Locale</div>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={settings.locale}
              onChange={(e) => void handleUpdateSettings({ locale: e.target.value })}
              placeholder="ja-JP"
            />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-700">Theme</div>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={settings.theme}
              onChange={(e) => void handleUpdateSettings({ theme: e.target.value as UserSettings["theme"] })}
            >
              <option value="system">system</option>
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium">SourceRule</h2>
        <p className="mt-1 text-sm text-gray-600">最小の追加/削除（同期対象）</p>

        <form
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAddRule(e.currentTarget);
          }}
        >
          <select name="type" className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-1">
            <option value="domain">domain</option>
            <option value="handle">handle</option>
          </select>
          <input
            name="label"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
            placeholder="label"
            required
          />
          <input
            name="pattern"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
            placeholder="example.com / @user"
            required
          />
          <input name="colorHex" className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-1" defaultValue="#3b82f6" />
          <button
            type="submit"
            disabled={!!busy}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-6 sm:justify-self-start"
          >
            追加
          </button>
        </form>

        <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200">
          {sourceRules.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">まだ SourceRule がありません</div>
          ) : (
            sourceRules.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-3 w-3 rounded-full" style={{ background: r.colorHex }} />
                    <span className="truncate font-medium">{r.label}</span>
                    <span className="text-xs text-gray-500">{r.type}</span>
                  </div>
                  <div className="truncate text-sm text-gray-600">{r.pattern}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteRule(r.id)}
                  disabled={!!busy}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                >
                  削除
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          userId: <code>{userId}</code>
        </div>
      </section>
    </main>
  );
}

export default function Page() {
  const searchParams = useSearchParams();
  const isPopup = searchParams.get("popup") === "1";
  const isOptions = searchParams.get("options") === "1";

  if (isPopup) return <PopupApp />;
  if (isOptions) return <OptionsApp />;
  return <SyncHome />;
}
