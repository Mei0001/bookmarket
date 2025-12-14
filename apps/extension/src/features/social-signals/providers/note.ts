import type { SocialSignal } from "@bookmarket/shared-kernel";
import { fetchWithTimeout, readTextSafe } from "../fetchUtils";
import { enforceProviderRateLimit } from "../rateLimit";

type JsonLd = Record<string, unknown>;

function extractJsonLdObjects(html: string): JsonLd[] {
  const results: JsonLd[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = (m[1] ?? "").trim();
    if (!raw) continue;
    try {
      const json = JSON.parse(raw) as unknown;
      if (Array.isArray(json)) {
        for (const item of json) {
          if (item && typeof item === "object") results.push(item as JsonLd);
        }
      } else if (json && typeof json === "object") {
        results.push(json as JsonLd);
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return results;
}

function findInteractionCount(ld: JsonLd): { likeCount?: number; commentCount?: number } {
  // Schema.org InteractionCounter (best-effort)
  const interaction = ld.interactionStatistic;
  const readCount = (value: unknown) => (Number.isFinite(value as number) ? Math.floor(value as number) : undefined);

  if (Array.isArray(interaction)) {
    let like: number | undefined;
    let comment: number | undefined;
    for (const it of interaction) {
      if (!it || typeof it !== "object") continue;
      const obj = it as Record<string, unknown>;
      const type = String(obj.interactionType ?? "");
      const count = readCount(obj.userInteractionCount);
      if (!count && count !== 0) continue;
      if (type.includes("Like")) like = count;
      if (type.includes("Comment")) comment = count;
    }
    return { likeCount: like, commentCount: comment };
  }

  if (interaction && typeof interaction === "object") {
    const obj = interaction as Record<string, unknown>;
    return {
      likeCount: readCount(obj.userInteractionCount),
      commentCount: undefined
    };
  }

  return {};
}

export async function fetchNoteSignal(url: string): Promise<Pick<SocialSignal, "likeCount" | "bookmarkCount" | "commentCount" | "fetchedFrom" | "ttlHours">> {
  // note.com は公式公開APIが不安定なため JSON-LD でbest-effort
  await enforceProviderRateLimit("note");

  let hostOk = false;
  try {
    const u = new URL(url);
    hostOk = u.hostname === "note.com" || u.hostname.endsWith(".note.com");
  } catch {
    hostOk = false;
  }

  if (!hostOk) {
    return { fetchedFrom: "note", likeCount: null, bookmarkCount: null, commentCount: null, ttlHours: 24 };
  }

  const res = await fetchWithTimeout(url, {
    timeoutMs: 2500,
    headers: {
      // JSON-LD が含まれるHTMLを取りに行く
      accept: "text/html"
    }
  });

  if (!res.ok) {
    const body = await readTextSafe(res);
    throw new Error(`Note fetch error: ${res.status} ${body}`);
  }

  const html = await readTextSafe(res);
  const lds = extractJsonLdObjects(html);
  for (const ld of lds) {
    const { likeCount, commentCount } = findInteractionCount(ld);
    if ((likeCount ?? null) !== null || (commentCount ?? null) !== null) {
      return {
        fetchedFrom: "note",
        likeCount: likeCount ?? null,
        commentCount: commentCount ?? null,
        bookmarkCount: null,
        ttlHours: 24
      };
    }
  }

  return { fetchedFrom: "note", likeCount: null, bookmarkCount: null, commentCount: null, ttlHours: 24 };
}
