import { describe, expect, it, vi } from "vitest";

import type { SourceRule } from "@bookmarket/shared-kernel";

import { buildBookmarkItemsFromChrome } from "./bookmarkSync";

describe("bookmarkSync", () => {
  it("対象ドメインのみ抽出し、サブドメインもマッチする", async () => {
    const rules: SourceRule[] = [
      {
        id: "sr_1",
        userId: "local",
        label: "Example",
        type: "domain",
        pattern: "example.com",
        colorHex: "#2563eb",
        syncStatus: "idle",
        lastSyncedAt: null,
        errorMessage: null
      }
    ];

    const originalCrypto = globalThis.crypto;
    const cryptoStub = {
      subtle: {
        digest: vi.fn(async (_alg: string, data: ArrayBuffer) => new Uint8Array([new Uint8Array(data).byteLength, 1, 2]).buffer)
      }
    } as unknown as Crypto;
    Object.defineProperty(globalThis, "crypto", { value: cryptoStub, configurable: true });

    try {
      const { bookmarks, report } = await buildBookmarkItemsFromChrome({
        sourceRules: rules,
        chromeBookmarks: [
          { id: "1", title: "A", url: "https://example.com/a", dateAdded: Date.UTC(2025, 0, 1) },
          { id: "2", title: "B", url: "https://sub.example.com/b", dateAdded: Date.UTC(2025, 0, 2) },
          { id: "3", title: "C", url: "https://other.com/c", dateAdded: Date.UTC(2025, 0, 3) }
        ],
        now: "2025-01-01T00:00:00.000Z"
      });

      expect(report.totalChromeBookmarks).toBe(3);
      expect(report.matched).toBe(2);
      expect(report.deduped).toBe(2);
      expect(bookmarks.map((b) => b.url)).toEqual(["https://example.com/a", "https://sub.example.com/b"]);
      expect(bookmarks.every((b) => b.sourceRuleId === "sr_1")).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true });
    }
  });

  it("同一URLは重複排除し、title は空でない方を採用する", async () => {
    const rules: SourceRule[] = [
      {
        id: "sr_1",
        userId: "local",
        label: "Example",
        type: "domain",
        pattern: "example.com",
        colorHex: "#2563eb",
        syncStatus: "idle",
        lastSyncedAt: null,
        errorMessage: null
      }
    ];

    const originalCrypto = globalThis.crypto;
    const cryptoStub = {
      subtle: {
        digest: vi.fn(async () => new Uint8Array([0, 1, 2]).buffer)
      }
    } as unknown as Crypto;
    Object.defineProperty(globalThis, "crypto", { value: cryptoStub, configurable: true });

    try {
      const { bookmarks, report } = await buildBookmarkItemsFromChrome({
        sourceRules: rules,
        chromeBookmarks: [
          { id: "1", title: "", url: "https://example.com/a", dateAdded: Date.UTC(2025, 0, 1) },
          { id: "2", title: "タイトルあり", url: "https://example.com/a", dateAdded: Date.UTC(2025, 0, 2) }
        ],
        now: "2025-01-01T00:00:00.000Z"
      });

      expect(report.matched).toBe(2);
      expect(report.deduped).toBe(1);
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]?.title).toBe("タイトルあり");
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true });
    }
  });

  it("複数ルールにマッチする場合はより具体的（patternが長い）なルールを優先する", async () => {
    const rules: SourceRule[] = [
      {
        id: "sr_root",
        userId: "local",
        label: "Root",
        type: "domain",
        pattern: "example.com",
        colorHex: "#2563eb",
        syncStatus: "idle",
        lastSyncedAt: null,
        errorMessage: null
      },
      {
        id: "sr_sub",
        userId: "local",
        label: "Sub",
        type: "domain",
        pattern: "sub.example.com",
        colorHex: "#22c55e",
        syncStatus: "idle",
        lastSyncedAt: null,
        errorMessage: null
      }
    ];

    const originalCrypto = globalThis.crypto;
    const cryptoStub = {
      subtle: {
        digest: vi.fn(async () => new Uint8Array([0, 1, 2]).buffer)
      }
    } as unknown as Crypto;
    Object.defineProperty(globalThis, "crypto", { value: cryptoStub, configurable: true });

    try {
      const { bookmarks } = await buildBookmarkItemsFromChrome({
        sourceRules: rules,
        chromeBookmarks: [{ id: "1", title: "B", url: "https://sub.example.com/b", dateAdded: Date.UTC(2025, 0, 1) }],
        now: "2025-01-01T00:00:00.000Z"
      });

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]?.sourceRuleId).toBe("sr_sub");
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true });
    }
  });
});

