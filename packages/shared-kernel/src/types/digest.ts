import { z } from "zod";

export const DigestPriorityItemSchema = z.object({
  bookmarkId: z.string().min(1),
  score: z.number().nonnegative()
});

export const DigestSnapshotSchema = z.object({
  id: z.string().min(1),
  generatedAt: z.string().datetime(),
  unreadCount: z.number().int().nonnegative(),
  priorityItems: z.array(DigestPriorityItemSchema),
  newSinceYesterday: z.number().int().nonnegative(),
  remindersDue: z.number().int().nonnegative(),
  summaryText: z.string().optional()
});

export type DigestSnapshot = z.infer<typeof DigestSnapshotSchema>;





