import { ok } from "@/lib/api/response";

export const dynamic = "force-static";

export async function GET() {
  return ok({
    status: "ok",
    timestamp: new Date().toISOString()
  });
}

