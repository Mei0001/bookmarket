type ProviderKey = "qiita" | "note" | "hatena" | "x" | "other";

const minIntervalMsByProvider: Record<ProviderKey, number> = {
  qiita: 900,
  note: 1200,
  hatena: 400,
  x: 1200,
  other: 1200
};

const nextAllowedAt = new Map<ProviderKey, number>();

/**
 * 非同期の最小間隔制御（同一プロバイダを短時間に叩きすぎない）。
 * - 429/5xx などのリトライは呼び出し側で実施
 */
export async function enforceProviderRateLimit(provider: ProviderKey) {
  const now = Date.now();
  const allowedAt = nextAllowedAt.get(provider) ?? 0;
  if (allowedAt > now) {
    await new Promise<void>((resolve) => setTimeout(resolve, allowedAt - now));
  }
  nextAllowedAt.set(provider, Date.now() + minIntervalMsByProvider[provider]);
}
