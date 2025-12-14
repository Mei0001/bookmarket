import { NextResponse } from "next/server";

export function ok<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, { status: 200, ...init });
}

export function created<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, { status: 201, ...init });
}

export function noContent(init?: ResponseInit) {
  // 204 MUST NOT include a response body.
  return new NextResponse(null, { status: 204, ...init });
}

export function badRequest(message: string, init?: ResponseInit) {
  return NextResponse.json({ error: message }, { status: 400, ...init });
}

export function serverError(message = "Unexpected error", init?: ResponseInit) {
  return NextResponse.json({ error: message }, { status: 500, ...init });
}
