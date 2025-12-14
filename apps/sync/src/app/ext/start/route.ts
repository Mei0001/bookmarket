import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!process.env.AUTH_GOOGLE_ID && !process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: "Missing Google OAuth env (AUTH_GOOGLE_ID/GOOGLE_CLIENT_ID)" }, { status: 500 });
  }
  if (!process.env.AUTH_GOOGLE_SECRET && !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Missing Google OAuth env (AUTH_GOOGLE_SECRET/GOOGLE_CLIENT_SECRET)" }, { status: 500 });
  }

  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!redirectUri) {
    return NextResponse.json({ error: "missing redirect_uri" }, { status: 400 });
  }

  const origin = url.origin;
  const callbackUrl = `${origin}/ext/complete?redirect_uri=${encodeURIComponent(redirectUri)}`;
  const signInUrl = `${origin}/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return NextResponse.redirect(signInUrl);
}

