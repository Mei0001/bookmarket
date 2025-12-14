import type { ExportJob } from "@bookmarket/shared-kernel";
import { badRequest, created, serverError } from "@/lib/api/response";
import { exportRowsToGoogleSheets } from "@/features/export/googleSheetsClient";
import { putJob, updateJob } from "@/features/export/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportRequestBody = {
  sheetName?: string;
  spreadsheetTitle?: string;
  includeFields?: Array<"title" | "url" | "savedAt" | "status" | "note" | "source" | "tags" | "reminder">;
  rows?: string[][];
};

function newJobId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function POST(req: Request) {
  let body: ExportRequestBody;
  try {
    body = (await req.json()) as ExportRequestBody;
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!body.rows || !Array.isArray(body.rows) || body.rows.length < 2) {
    return badRequest("rows is required (including header row)");
  }

  const sheetName = body.sheetName?.trim() || "Bookmarket";
  const spreadsheetTitle = body.spreadsheetTitle?.trim() || `Bookmarket Export ${new Date().toISOString().slice(0, 10)}`;

  const job: ExportJob = {
    id: newJobId(),
    status: "pending",
    requestedAt: new Date().toISOString(),
    completedAt: null,
    sheetUrl: null
  };

  putJob(job);

  // 非同期で実行（UIはステータスをポーリング）
  void (async () => {
    try {
      updateJob(job.id, { status: "running" });
      const result = await exportRowsToGoogleSheets({ spreadsheetTitle, sheetName, rows: body.rows! });
      updateJob(job.id, {
        status: "succeeded",
        sheetUrl: result.sheetUrl,
        rowCount: result.rowCount,
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      updateJob(job.id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString()
      });
    }
  })();

  return created(job, { status: 202 });
}

export async function GET() {
  return serverError("Use GET /api/export/google-sheets/:id to check status");
}
