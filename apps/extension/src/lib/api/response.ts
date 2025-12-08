import { NextResponse } from "next/server";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export function ok<T>(payload: T, init?: ResponseInit) {
  const body: ApiResponse<T> = { data: payload };
  return NextResponse.json(body, { status: 200, ...init });
}

export function created<T>(payload: T, init?: ResponseInit) {
  const body: ApiResponse<T> = { data: payload };
  return NextResponse.json(body, { status: 201, ...init });
}

export function noContent(init?: ResponseInit) {
  return NextResponse.json({ data: null }, { status: 204, ...init });
}

export function badRequest(message: string, init?: ResponseInit) {
  return NextResponse.json({ error: message }, { status: 400, ...init });
}

export function serverError(message = "Unexpected error", init?: ResponseInit) {
  return NextResponse.json({ error: message }, { status: 500, ...init });
}

