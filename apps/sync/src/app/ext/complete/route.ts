import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { base64urlEncodeJson } from "@/lib/base64url";
import { signExtensionToken } from "@/lib/extensionToken";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!redirectUri) {
    return NextResponse.json({ error: "missing redirect_uri" }, { status: 400 });
  }

  const session = await auth();
  const user = session?.user;
  const userId = user ? (user as { id?: string }).id : undefined;
  const email = user?.email ?? undefined;
  const name = user?.name ?? undefined;
  const picture = user?.image ?? undefined;

  if (!userId || !email) {
    const fail = new URL(redirectUri);
    fail.hash = "error=NotAuthenticated";
    return NextResponse.redirect(fail.toString());
  }

  const token = await signExtensionToken({ userId, email, name, picture, expiresIn: "30d" });
  const profilePayload = base64urlEncodeJson({
    userId,
    email,
    displayName: name ?? email,
    avatarUrl: picture ?? null,
  });

  const ok = new URL(redirectUri);
  ok.hash = `token=${encodeURIComponent(token)}&profile=${encodeURIComponent(profilePayload)}`;
  return NextResponse.redirect(ok.toString());
}

