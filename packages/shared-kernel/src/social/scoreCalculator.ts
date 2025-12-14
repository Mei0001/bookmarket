import type { BookmarkItem } from "../types/bookmark";
import type { ReviewReminder } from "../types/reminder";
import type { SocialSignal } from "../types/socialSignal";

export type ScoreInputs = {
  bookmark: BookmarkItem;
  socialSignal?: SocialSignal | null;
  reminder?: ReviewReminder | null;
  now?: Date;
};

function toMillis(iso: string) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * US4向けの簡易スコア。
 * - 社会的指標（bookmark/like/comment）を主に扱う
 * - 直近保存のボーナス
 * - 期限超過のリマインダーがあれば軽くブースト
 */
export function calculateBookmarkScore({ bookmark, socialSignal, reminder, now = new Date() }: ScoreInputs): number {
  const like = socialSignal?.likeCount ?? 0;
  const bkm = socialSignal?.bookmarkCount ?? 0;
  const comment = socialSignal?.commentCount ?? 0;

  const savedAtMs = toMillis(bookmark.savedAt);
  const ageHours = savedAtMs ? Math.max(0, (now.getTime() - savedAtMs) / (1000 * 60 * 60)) : 9999;

  // 直近ほど加点（最大 20）
  const recencyBonus = Math.max(0, 20 - ageHours);

  // リマインダー期限超過/当日分（最大 15）
  let reminderBonus = 0;
  if (reminder?.scheduledFor) {
    const scheduledMs = toMillis(reminder.scheduledFor);
    if (scheduledMs && scheduledMs <= now.getTime()) {
      reminderBonus = 15;
    } else if (scheduledMs) {
      const hoursTo = (scheduledMs - now.getTime()) / (1000 * 60 * 60);
      reminderBonus = Math.max(0, 10 - hoursTo);
    }
  }

  // 社会的反応の重み（ブクマをやや重め）
  const signalScore = bkm * 3 + like * 1 + comment * 2;

  return Math.max(0, signalScore + recencyBonus + reminderBonus);
}

export type RankedItem = {
  bookmarkId: string;
  score: number;
};

export function rankBookmarksByPriority(inputs: Array<{ bookmark: BookmarkItem; socialSignal?: SocialSignal | null; reminder?: ReviewReminder | null }>, now = new Date()) {
  const ranked: RankedItem[] = inputs.map(({ bookmark, socialSignal, reminder }) => ({
    bookmarkId: bookmark.id,
    score: calculateBookmarkScore({ bookmark, socialSignal, reminder, now })
  }));

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
