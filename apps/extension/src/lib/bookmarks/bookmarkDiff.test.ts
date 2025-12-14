import { describe, expect, it, vi } from "vitest";

import { diffById, hashBookmarkIds, stableDeepEqual } from "./bookmarkDiff";

describe("bookmarkDiff", () => {
  it("diffById: created/updated/removed を計算できる", () => {
    const previous = [
      { id: "1", title: "a" },
      { id: "2", title: "b" }
    ];
    const next = [
      { id: "2", title: "b2" },
      { id: "3", title: "c" }
    ];

    const diff = diffById(previous, next);

    expect(diff.created.map((x) => x.id)).toEqual(["3"]);
    expect(diff.updated.map((x) => x.id)).toEqual(["2"]);
    expect(diff.removed.map((x) => x.id)).toEqual(["1"]);
  });

  it("stableDeepEqual: オブジェクトキー順が違っても等価", () => {
    expect(stableDeepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("hashBookmarkIds: crypto.subtle.digest の結果をhexにする", async () => {
    const originalCrypto = globalThis.crypto;

    // jsdom 環境で crypto.subtle が無い場合があるためテスト内でスタブ
    const cryptoStub = {
      subtle: {
        digest: vi.fn(async () => new Uint8Array([0, 1, 2]).buffer)
      }
    } as unknown as Crypto;
    Object.defineProperty(globalThis, "crypto", { value: cryptoStub, configurable: true });

    try {
      const hex = await hashBookmarkIds([{ id: "a" }, { id: "b" }]);
      expect(hex).toBe("000102");
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true });
    }
  });
});
