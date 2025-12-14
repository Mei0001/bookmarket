"use client";

import type { BookmarkItem, ExportJob } from "@bookmarket/shared-kernel";
import { useCallback, useMemo, useState } from "react";
import { persistExportJob } from "@/lib/storage/indexedDbClient";

type Props = {
  disabled?: boolean;
  getBookmarks: () => Promise<BookmarkItem[]>;
  onFinished?: () => void;
};

type ExportState = {
  job: ExportJob | null;
  phase: "idle" | "starting" | "polling" | "succeeded" | "failed";
  error: string | null;
};

function buildRows(bookmarks: BookmarkItem[]) {
  const header = ["title", "url", "savedAt", "status", "note", "source", "tags"];
  const rows = bookmarks.map((b) => [
    b.title,
    b.url,
    b.savedAt,
    b.status,
    b.note ?? "",
    b.sourceRuleId,
    (b.tags ?? []).join(",")
  ]);
  return [header, ...rows];
}

async function startExport(rows: string[][]) {
  const res = await fetch("/api/export/google-sheets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sheetName: "Bookmarket", rows })
  });

  const data = (await res.json()) as ExportJob | { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Export request failed (${res.status})`);
  }

  return data as ExportJob;
}

async function pollJob(id: string) {
  const res = await fetch(`/api/export/google-sheets/${encodeURIComponent(id)}`, { method: "GET" });
  const data = (await res.json()) as ExportJob | { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Status request failed (${res.status})`);
  }
  return data as ExportJob;
}

export function SheetExportButton(props: Props) {
  const [state, setState] = useState<ExportState>({ job: null, phase: "idle", error: null });

  const canRun = useMemo(() => !props.disabled && state.phase !== "starting" && state.phase !== "polling", [props.disabled, state.phase]);

  const run = useCallback(async () => {
    setState({ job: null, phase: "starting", error: null });

    try {
      const bookmarks = await props.getBookmarks();
      if (!bookmarks.length) {
        setState({ job: null, phase: "failed", error: "ブックマークがありません" });
        return;
      }

      const rows = buildRows(bookmarks);
      const job = await startExport(rows);
      await persistExportJob(job);

      setState({ job, phase: "polling", error: null });

      const startedAt = Date.now();
      // 最大60秒ポーリング
      while (Date.now() - startedAt < 60_000) {
        const next = await pollJob(job.id);
        await persistExportJob(next);
        if (next.status === "succeeded") {
          setState({ job: next, phase: "succeeded", error: null });
          props.onFinished?.();
          return;
        }
        if (next.status === "failed") {
          setState({ job: next, phase: "failed", error: next.errorMessage ?? "エクスポートに失敗しました" });
          return;
        }
        await new Promise<void>((r) => setTimeout(r, 1500));
      }

      setState((prev) => ({ ...prev, phase: "failed", error: "タイムアウトしました（再試行してください）" }));
    } catch (e) {
      setState({ job: null, phase: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }, [props]);

  const label = state.phase === "starting" ? "開始中..." : state.phase === "polling" ? "実行中..." : "Google Sheetsへエクスポート";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!canRun}
          onClick={run}
        >
          {label}
        </button>

        {state.phase === "failed" ? (
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            disabled={!canRun}
            onClick={run}
          >
            再試行
          </button>
        ) : null}

        {state.job?.sheetUrl && state.phase === "succeeded" ? (
          <a
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            href={state.job.sheetUrl}
            target="_blank"
            rel="noreferrer"
          >
            シートを開く
          </a>
        ) : null}
      </div>

      {state.error ? <p className="text-sm text-warning">{state.error}</p> : null}

      {state.job ? (
        <p className="text-xs text-gray-500">
          job: <span className="font-mono">{state.job.id}</span> / status: <span className="font-mono">{state.job.status}</span>
        </p>
      ) : null}

      <p className="text-xs text-gray-500">
        必要な環境変数: <span className="font-mono">GOOGLE_SHEETS_CLIENT_EMAIL</span>, <span className="font-mono">GOOGLE_SHEETS_PRIVATE_KEY</span>
      </p>
    </div>
  );
}
