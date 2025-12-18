import type { SocialSignal } from "@bookmarket/shared-kernel";
import { fetchHatenaSignal } from "./hatena";
import { fetchQiitaSignal } from "./qiita";
import { fetchNoteSignal } from "./note";
import { fetchXSignal } from "./x";

export type SocialSignalProviderKey = SocialSignal["fetchedFrom"];

export function detectProvider(url: string): SocialSignalProviderKey {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host === "qiita.com") return "qiita";
    if (host === "note.com" || host.endsWith(".note.com")) return "note";
    if (host === "x.com" || host === "twitter.com" || host === "www.twitter.com") return "x";
    // それ以外は Hatena のブクマ数だけでも取れるケースが多い
    return "hatena";
  } catch {
    return "other";
  }
}

export async function fetchSignalByProvider(provider: SocialSignalProviderKey, url: string) {
  switch (provider) {
    case "qiita":
      return fetchQiitaSignal(url);
    case "note":
      return fetchNoteSignal(url);
    case "x":
      return fetchXSignal(url);
    case "hatena":
      return fetchHatenaSignal(url);
    case "other":
    default:
      return { fetchedFrom: "other" as const, likeCount: null, bookmarkCount: null, commentCount: null, ttlHours: 24 };
  }
}
