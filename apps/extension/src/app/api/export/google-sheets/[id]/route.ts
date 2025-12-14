import { ok, badRequest } from "@/lib/api/response";
import { getJob } from "@/features/export/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return badRequest("Missing id");

  const job = getJob(id);
  if (!job) return ok({ id, status: "failed", requestedAt: new Date().toISOString(), errorMessage: "Job not found" }, { status: 200 });

  return ok(job);
}
