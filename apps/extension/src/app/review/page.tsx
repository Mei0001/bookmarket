"use client";

import { useState } from "react";
import type { BookmarkItem } from "@bookmarket/shared-kernel";
import { useBookmarkStateStore } from "@/lib/bookmarks/bookmarkStateStore";

function formatIsoForInput(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nowIso() {
  return new Date().toISOString();
}

function badgeForStatus(status: BookmarkItem["status"]) {
  switch (status) {
    case "unread":
      return { label: "未確認", className: "bg-blue-50 text-blue-700 ring-blue-200" };
    case "done":
      return { label: "確認済み", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    case "snoozed":
      return { label: "リマインド中", className: "bg-amber-50 text-amber-700 ring-amber-200" };
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unknown status: ${String(_exhaustive)}`);
    }
  }
}

function isOverdue(iso: string) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms <= Date.now() : false;
}

export default function ReviewPage() {
  const { loading, filtered, remindersById, filter, undoStack, actions } = useBookmarkStateStore();
  const [openReminderFor, setOpenReminderFor] = useState<string | null>(null);
  const [scheduleInputById, setScheduleInputById] = useState<Record<string, string>>({});

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-widest text-gray-500">US3</p>
          <h1 className="text-3xl font-semibold">Bookmarket</h1>
          <p className="text-sm text-gray-600">未確認/確認済みの管理と、最大5回の再通知リマインド。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void actions.syncFromChrome()}
            disabled={loading}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            Chromeから同期（httpsのみ）
          </button>
          <button
            onClick={() => void actions.undo()}
            disabled={undoStack.length === 0}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            Undo
          </button>
        </div>
      </header>

      <section className="flex flex-wrap gap-2">
        {(["all", "unread", "snoozed", "done"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => actions.setFilter(tab)}
            className={[
              "rounded-full px-4 py-2 text-sm ring-1 transition",
              filter === tab ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
            ].join(" ")}
          >
            {tab === "all" ? "すべて" : badgeForStatus(tab).label}
          </button>
        ))}
      </section>

      <section className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
            まだブックマークがありません。「Chromeから同期」を押してください。
          </div>
        ) : null}

        {filtered.map((b) => {
          const badge = badgeForStatus(b.status);
          const reminder = b.reminderId ? remindersById[b.reminderId] : undefined;
          const overdue = reminder?.scheduledFor ? isOverdue(reminder.scheduledFor) : false;
          const scheduleValue =
            scheduleInputById[b.id] ?? (reminder?.scheduledFor ? formatIsoForInput(reminder.scheduledFor) : formatIsoForInput(nowIso()));

          return (
            <article key={b.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${badge.className}`}>{badge.label}</span>
                    {b.status === "snoozed" && reminder ? (
                      <span className={`text-xs ${overdue ? "text-red-700" : "text-gray-600"}`}>
                        期限: {new Date(reminder.scheduledFor).toLocaleString()}（再通知 {reminder.repeatCount}/5 / {reminder.status}）
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-2 truncate text-lg font-semibold text-gray-900">
                    <a className="hover:underline" href={b.url} target="_blank" rel="noreferrer">
                      {b.title}
                    </a>
                  </h2>
                  <p className="mt-1 truncate text-xs text-gray-500">{b.url}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void actions.toggleDone(b.id)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    {b.status === "done" ? "未確認に戻す" : "確認済みにする"}
                  </button>
                  <button
                    onClick={() => setOpenReminderFor((prev) => (prev === b.id ? null : b.id))}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    リマインダー
                  </button>
                  {b.reminderId ? (
                    <button
                      onClick={() => void actions.clearReminderFor(b.id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      解除
                    </button>
                  ) : null}
                </div>
              </div>

              {openReminderFor === b.id ? (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">スヌーズ（期限設定）</p>
                      <p className="text-xs text-gray-600">期限になると通知し、最大5回まで再通知します。</p>
                    </div>

                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="text-xs text-gray-500">期限</span>
                        <input
                          type="datetime-local"
                          value={scheduleValue}
                          onChange={(e) =>
                            setScheduleInputById((prev) => ({
                              ...prev,
                              [b.id]: e.target.value
                            }))
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <button
                        onClick={() => {
                          const raw = scheduleInputById[b.id] ?? scheduleValue;
                          const when = raw ? new Date(raw).toISOString() : nowIso();
                          void actions.snooze(b.id, when);
                        }}
                        className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
                      >
                        リマインド設定
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
