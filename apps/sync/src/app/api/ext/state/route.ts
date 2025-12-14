import { NextResponse } from "next/server";
import { verifyExtensionToken } from "@/lib/extensionToken";
import { corsPreflight, withCors } from "@/lib/cors";
import { loadUserState, normalizeIncomingState, saveUserState, UserStateSchema } from "@/lib/userStateStore";

export const runtime = "nodejs";

function unauthorized(request: Request, message = "Unauthorized") {
  return withCors(request, NextResponse.json({ error: message }, { status: 401 }));
}

async function getAuthContext(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  try {
    return await verifyExtensionToken(token);
  } catch (error) {
    console.warn("[sync] invalid extension token", error);
    return null;
  }
}

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return unauthorized(request);

  const state = await loadUserState(auth.userId);
  const res = state ? NextResponse.json(state, { status: 200 }) : NextResponse.json({ error: "NotFound" }, { status: 404 });
  return withCors(request, res);
}

export async function PUT(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return unauthorized(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(request, NextResponse.json({ error: "InvalidJson" }, { status: 400 }));
  }

  const { profile, settings, sourceRules, bookmarks } = normalizeIncomingState({
    userId: auth.userId,
    email: auth.email,
    name: auth.name,
    picture: auth.picture,
    settings: (body as { settings?: unknown } | null)?.settings,
    sourceRules: (body as { sourceRules?: unknown } | null)?.sourceRules,
    bookmarks: (body as { bookmarks?: unknown } | null)?.bookmarks,
  });

  const saved = await saveUserState(auth.userId, { profile, settings, sourceRules, bookmarks });
  // 念の為 round-trip 検証（壊れたデータを返さない）
  UserStateSchema.parse(saved);

  return withCors(request, NextResponse.json(saved, { status: 200 }));
}

