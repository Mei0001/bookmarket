export const MAX_RENOTIFY_COUNT = 5;

// 再通知間隔（1回目送信後→次、2回目送信後→次...）
// repeatCount は「これまで送った回数」。
const RENOTIFY_DELAYS_MINUTES = [60, 180, 720, 1440] as const;

export function computeNextScheduledFor(nowMs: number, currentRepeatCount: number): string | null {
  if (!Number.isFinite(nowMs)) throw new Error("nowMs must be a finite number");
  if (!Number.isInteger(currentRepeatCount) || currentRepeatCount < 0) {
    throw new Error("currentRepeatCount must be an int >= 0");
  }
  // 「今回送信したあと、次の再通知をスケジュールするか」を返す。
  // 次回を作るのは「送信回数が MAX に到達する前」まで。
  if (currentRepeatCount >= MAX_RENOTIFY_COUNT - 1) return null;

  const delay = RENOTIFY_DELAYS_MINUTES[currentRepeatCount] ?? RENOTIFY_DELAYS_MINUTES[RENOTIFY_DELAYS_MINUTES.length - 1];
  return new Date(nowMs + delay * 60_000).toISOString();
}

