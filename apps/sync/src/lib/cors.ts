import { NextResponse } from "next/server";

function isAllowedOrigin(origin: string) {
  const env = process.env.EXT_ALLOWED_ORIGINS;
  if (env) {
    const allowed = env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.includes("*")) return true;
    return allowed.includes(origin);
  }

  // dev / 最小実装: 拡張機能と localhost を許可
  return origin.startsWith("chrome-extension://") || origin.startsWith("http://localhost:") || origin.startsWith("https://localhost:");
}

export function withCors(request: Request, response: NextResponse) {
  const origin = request.headers.get("origin");
  if (!origin) return response;
  if (!isAllowedOrigin(origin)) return response;

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
  response.headers.set("Access-Control-Max-Age", "600");
  return response;
}

export function corsPreflight(request: Request) {
  const res = new NextResponse(null, { status: 204 });
  return withCors(request, res);
}

