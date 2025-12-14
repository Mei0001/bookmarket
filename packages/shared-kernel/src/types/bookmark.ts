import { z } from "zod";

export const BookmarkStatusSchema = z.enum(["unread", "done", "snoozed"]);

const HttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "URL must start with https://");

export const BookmarkItemSchema = z
  .object({
    id: z.string().min(1),
    sourceRuleId: z.string().min(1),
    title: z.string().min(1),
    url: HttpsUrlSchema,
    savedAt: z.string().datetime(),
    status: BookmarkStatusSchema.default("unread"),
    // openapi.yaml では nullable。内部保存でも null が混ざっても壊れないよう許容。
    note: z.string().max(2000).nullable().optional(),
    duplicateOf: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    // data-model.md では必須
    lastUpdatedAt: z.string().datetime(),
    // 正規化（内部永続化）用の参照
    socialSignalId: z.string().optional(),
    reminderId: z.string().optional()
  })
  .superRefine((value, ctx) => {
    // data-model.md: status が snoozed の場合 reminderId 必須
    if (value.status === "snoozed" && !value.reminderId) {
      ctx.addIssue({ code: "custom", path: ["reminderId"], message: "reminderId is required when status is snoozed" });
    }
  });

export type BookmarkItem = z.infer<typeof BookmarkItemSchema>;

// API contract variants (openapi.yaml)
export const BookmarkUpsertSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  savedAt: z.string().datetime(),
  sourceRuleId: z.string().min(1).optional(),
  note: z.string().nullable().optional()
});
export type BookmarkUpsert = z.infer<typeof BookmarkUpsertSchema>;






