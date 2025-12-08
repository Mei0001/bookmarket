import { z } from "zod";

export const SourceRuleSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  label: z.string().min(1).max(40),
  type: z.enum(["domain", "handle"]),
  pattern: z.string().min(1),
  colorHex: z.string().regex(/^#([0-9A-Fa-f]{6})$/, "Expected hex color"),
  syncStatus: z.enum(["idle", "syncing", "error"]).default("idle"),
  lastSyncedAt: z.string().datetime().nullable(),
  errorMessage: z.string().optional()
});

export type SourceRule = z.infer<typeof SourceRuleSchema>;

