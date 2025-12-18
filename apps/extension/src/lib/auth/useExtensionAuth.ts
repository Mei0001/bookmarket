"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthProfile, UserSettings } from "@bookmarket/shared-kernel";
import { UserSettingsSchema } from "@bookmarket/shared-kernel";
import { clearAuthSession, loadAuthSession, saveAuthSession } from "@/lib/auth/authStore";
import { signInWithGoogleViaLaunchWebAuthFlow } from "@/lib/auth/googleSignIn";
import { fetchRemoteState, pushRemoteState } from "@/lib/sync/syncClient";
import {
  getAllBookmarks,
  getAllSourceRules,
  getUserSettings,
  overwriteAllBookmarks,
  overwriteAllSourceRules,
  persistUserSettings
} from "@/lib/storage/indexedDbClient";

export type ExtensionAuthSession = Awaited<ReturnType<typeof loadAuthSession>>;

function isExtensionRuntime() {
  return typeof chrome !== "undefined" && !!chrome.runtime?.id;
}

export function useExtensionAuth() {
  const [session, setSession] = useState<ExtensionAuthSession>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncBaseUrl = useMemo(() => process.env.NEXT_PUBLIC_SYNC_BASE_URL ?? "http://localhost:3001", []);

  const userId = session?.profile.userId ?? "local";
  const token = session?.token ?? null;
  const canInteractiveSignIn = isExtensionRuntime();

  const reloadSession = useCallback(async () => {
    const loaded = await loadAuthSession();
    setSession(loaded);
    return loaded;
  }, []);

  const refreshLocalState = useCallback(async () => {
    const [rules, storedSettings] = await Promise.all([getAllSourceRules(), getUserSettings()]);
    return {
      sourceRules: rules,
      settings: UserSettingsSchema.parse(storedSettings ?? {})
    };
  }, []);

  const restoreFromRemote = useCallback(async () => {
    setError(null);
    if (!token) {
      setError("未ログインのため復元できません。");
      return;
    }
    setBusy("復元中…");
    try {
      const remote = await fetchRemoteState(token);
      await overwriteAllSourceRules(remote.sourceRules);
      await persistUserSettings(remote.settings);
      await overwriteAllBookmarks(remote.bookmarks);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [token]);

  const pushToRemote = useCallback(async () => {
    setError(null);
    if (!token) {
      setError("未ログインのため同期できません。");
      return;
    }
    setBusy("同期中…");
    try {
      const [rules, settings, bookmarks] = await Promise.all([getAllSourceRules(), getUserSettings(), getAllBookmarks()]);
      await pushRemoteState(token, {
        settings: UserSettingsSchema.parse(settings ?? {}),
        sourceRules: rules,
        bookmarks
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [token]);

  const signIn = useCallback(async () => {
    setError(null);
    if (!canInteractiveSignIn) {
      setError("拡張機能環境ではないためサインインできません。");
      return;
    }
    setBusy("サインイン中…");
    try {
      const result = await signInWithGoogleViaLaunchWebAuthFlow({ syncBaseUrl });
      await saveAuthSession(result);
      const loaded = await reloadSession();
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [canInteractiveSignIn, reloadSession, syncBaseUrl]);

  const signOut = useCallback(async () => {
    setError(null);
    setBusy("サインアウト中…");
    try {
      await clearAuthSession();
      await reloadSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [reloadSession]);

  // 初回ロードでセッション復元
  useEffect(() => {
    void reloadSession();
  }, [reloadSession]);

  const profile: Pick<AuthProfile, "userId" | "email" | "displayName" | "avatarUrl" | "settings"> | null = session?.profile ?? null;

  const effectiveSettings: UserSettings | null = profile?.settings ? UserSettingsSchema.parse(profile.settings) : null;

  return {
    session,
    profile,
    userId,
    token,
    syncBaseUrl,
    busy,
    error,
    canInteractiveSignIn,
    effectiveSettings,
    actions: {
      reloadSession,
      refreshLocalState,
      signIn,
      signOut,
      restoreFromRemote,
      pushToRemote
    }
  };
}

