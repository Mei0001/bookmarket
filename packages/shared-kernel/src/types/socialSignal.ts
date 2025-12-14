import { z } from "zod";

export const SocialSignalSchema = z.object({
  id: z.string().min(1),
  bookmarkId: z.string().min(1),
  likeCount: z.number().int().nonnegative().nullable().default(null),
  bookmarkCount: z.number().int().nonnegative().nullable().default(null),
  commentCount: z.number().int().nonnegative().nullable().default(null),
  fetchedFrom: z.enum(["qiita", "note", "hatena", "x", "other"]),
  fetchedAt: z.string().datetime(),
  ttlHours: z.number().int().positive().max(72).default(24)
});

export type SocialSignal = z.infer<typeof SocialSignalSchema>;







