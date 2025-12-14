import { z } from "zod";

export const ReviewReminderSchema = z.object({
  id: z.string().min(1),
  bookmarkId: z.string().min(1),
  scheduledFor: z.string().datetime(),
  repeatCount: z.number().int().min(0).max(5).default(0),
  status: z.enum(["scheduled", "sent", "completed", "exhausted"]).default("scheduled"),
  channel: z.enum(["digest"]).default("digest")
});

export type ReviewReminder = z.infer<typeof ReviewReminderSchema>;






