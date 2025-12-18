"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useExtensionAuth } from "@/lib/auth/useExtensionAuth";

function GearIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={props.className ?? "h-5 w-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.2 2.2 0 0 1-1.56 3.75 2.2 2.2 0 0 1-1.55-.65l-.05-.05A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1.09 1.62V21a2.2 2.2 0 0 1-4.4 0v-.07A1.8 1.8 0 0 0 8.4 19.4a1.8 1.8 0 0 0-1.98.36l-.05.05a2.2 2.2 0 1 1-3.1-3.1l.05-.05A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.62-1.09H2.9a2.2 2.2 0 0 1 0-4.4h.07A1.8 1.8 0 0 0 4.6 8.4a1.8 1.8 0 0 0-.36-1.98l-.05-.05a2.2 2.2 0 0 1 3.1-3.1l.05.05A1.8 1.8 0 0 0 8.4 4.6 1.8 1.8 0 0 0 9.5 2.98V2.9a2.2 2.2 0 0 1 4.4 0v.07A1.8 1.8 0 0 0 15 4.6a1.8 1.8 0 0 0 1.98-.36l.05-.05a2.2 2.2 0 1 1 3.1 3.1l-.05.05A1.8 1.8 0 0 0 19.4 8.4c.43.26.75.69.84 1.19.04.16.06.33.06.5s-.02.34-.06.5A1.8 1.8 0 0 0 21.02 12h.08a2.2 2.2 0 0 1 0 4.4h-.07A1.8 1.8 0 0 0 19.4 15Z" />
    </svg>
  );
}

function MenuButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "default" | "danger" }) {
  const variant = props.variant ?? "default";
  const base =
    "w-full rounded-lg px-3 py-2 text-left text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";
  const style =
    variant === "primary"
      ? "bg-[color:var(--accent)] text-white"
      : variant === "danger"
        ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
        : "border border-[color:var(--border)] bg-white hover:bg-[color:var(--surface)]";

  return <button {...props} className={[base, style, props.className ?? ""].join(" ")} />;
}

export function SettingsMenu(props: { showLinks?: boolean }) {
  const auth = useExtensionAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-xl border border-border bg-surface-alt p-2 hover:bg-surface"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="設定"
      >
        <GearIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-border bg-white p-3 shadow-card"
        >
          <div className="px-1 pb-2">
            <p className="text-xs text-gray-500">アカウント</p>
            {auth.profile ? (
              <p className="mt-1 truncate text-sm font-medium text-gray-900">{auth.profile.email}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-700">未ログイン</p>
            )}
            {auth.busy ? <p className="mt-2 text-xs text-blue-700">{auth.busy}</p> : null}
            {auth.error ? <p className="mt-2 text-xs text-orange-600">{auth.error}</p> : null}
          </div>

          <div className="grid gap-2">
            {!auth.profile ? (
              <MenuButton
                variant="primary"
                onClick={() => {
                  setOpen(false);
                  void auth.actions.signIn();
                }}
                disabled={!!auth.busy || !auth.canInteractiveSignIn}
                title={auth.canInteractiveSignIn ? "Googleでサインイン" : "拡張機能として実行してください"}
              >
                Googleでログイン
              </MenuButton>
            ) : (
              <>
                <MenuButton
                  onClick={() => {
                    setOpen(false);
                    void auth.actions.pushToRemote();
                  }}
                  disabled={!auth.token || !!auth.busy}
                >
                  同期（保存）
                </MenuButton>
                <MenuButton
                  onClick={() => {
                    setOpen(false);
                    void auth.actions.restoreFromRemote();
                  }}
                  disabled={!auth.token || !!auth.busy}
                >
                  復元
                </MenuButton>
                <MenuButton
                  variant="danger"
                  onClick={() => {
                    setOpen(false);
                    void auth.actions.signOut();
                  }}
                  disabled={!!auth.busy}
                >
                  サインアウト
                </MenuButton>
              </>
            )}
          </div>

          {props.showLinks ?? true ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="px-1 text-xs text-gray-500">ショートカット</p>
              <div className="mt-2 grid gap-2">
                <Link
                  href="/?options=1"
                  className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-[color:var(--surface)]"
                  onClick={() => setOpen(false)}
                >
                  Options（対象ドメイン設定）
                </Link>
                <Link
                  href="/?popup=1"
                  className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-[color:var(--surface)]"
                  onClick={() => setOpen(false)}
                >
                  Popup（一覧）
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

