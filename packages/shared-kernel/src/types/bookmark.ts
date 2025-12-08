import { z } from "zod";

export const BookmarkStatusSchema = z.enum(["unread", "done", "snoozed"]);

export const BookmarkItemSchema = z.object({
  id: z.string().min(1),
  sourceRuleId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  savedAt: z.string().datetime(),
  status: BookmarkStatusSchema.default("unread"),
  note: z.string().max(2000).optional(),
  duplicateOf: z.string().optional(),
  tags: z.array(z.string()).default([]),
  lastUpdatedAt: z.string().datetime().optional(),
  socialSignalId: z.string().optional(),
  reminderId: z.string().optional()
});

export type BookmarkItem = z.infer<typeof BookmarkItemSchema>;

