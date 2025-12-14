import type { BookmarkItem, SourceRule, UserSettings } from "@bookmarket/shared-kernel";

export type RemoteUserState = {
  profile: {
    userId: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    settings: UserSettings;
  };
  settings: UserSettings;
  sourceRules: SourceRule[];
  bookmarks: BookmarkItem[];
  updatedAt: string;
};

function baseUrl() {
  // Next export でも参照できるよう、public env + fallback
  return (process.env.NEXT_PUBLIC_SYNC_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

export async function fetchRemoteState(token: string): Promise<RemoteUserState> {
  const res = await fetch(`${baseUrl()}/api/ext/state`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    throw new Error(`fetchRemoteState failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json as RemoteUserState;
}

export async function pushRemoteState(token: string, body: { settings: UserSettings; sourceRules: SourceRule[]; bookmarks: BookmarkItem[] }) {
  const res = await fetch(`${baseUrl()}/api/ext/state`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    throw new Error(`pushRemoteState failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json as RemoteUserState;
}

