import { z } from "zod";

const ColorHexSchema = z.string().regex(/^#([0-9A-Fa-f]{6})$/, "Expected hex color (#RRGGBB)");

export const SourceRuleTypeSchema = z.enum(["domain", "handle"]);
export const SourceRuleSyncStatusSchema = z.enum(["idle", "syncing", "error"]);

// NOTE:
// - domain は URL ではなく「ドメイン名」を想定（例: example.com, sub.example.co.jp）
// - handle は @handle 形式を想定
const DomainPatternSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      // scheme/パス/ポートを含めない
      !/[:/]/.test(value) &&
      // 簡易ドメイン判定（ラベル.ラベル...）
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(value),
    "Expected a domain like example.com (no scheme/path)"
  );

const HandlePatternSchema = z
  .string()
  .min(2)
  .refine((value) => /^@[A-Za-z0-9_][A-Za-z0-9_.-]{0,38}$/.test(value), "Expected a handle like @user");

export const SourceRuleSchema = z
  .object({
    id: z.string().min(1),
    // data-model.md: anonymous modeでは "local" 固定。API契約では userId はセッションから導出される想定。
    userId: z.string().min(1),
    label: z.string().min(1).max(40),
    type: SourceRuleTypeSchema,
    pattern: z.string().min(1),
    colorHex: ColorHexSchema,
    syncStatus: SourceRuleSyncStatusSchema.default("idle"),
    lastSyncedAt: z.string().datetime().nullable(),
    // openapi.yaml では nullable。永続化/統合時に null が混ざっても壊れないよう許容する。
    errorMessage: z.string().nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (value.type === "domain") {
      const result = DomainPatternSchema.safeParse(value.pattern);
      if (!result.success) {
        ctx.addIssue({ code: "custom", path: ["pattern"], message: result.error.issues[0]?.message ?? "Invalid domain" });
      }
    }
    if (value.type === "handle") {
      const result = HandlePatternSchema.safeParse(value.pattern);
      if (!result.success) {
        ctx.addIssue({ code: "custom", path: ["pattern"], message: result.error.issues[0]?.message ?? "Invalid handle" });
      }
    }
  });

export type SourceRule = z.infer<typeof SourceRuleSchema>;

// API contract variants (openapi.yaml)
export const SourceRuleApiSchema = SourceRuleSchema.omit({ userId: true });
export type SourceRuleApi = z.infer<typeof SourceRuleApiSchema>;

export const SourceRuleCreateSchema = z
  .object({
    label: z.string().min(1).max(40),
    type: SourceRuleTypeSchema,
    pattern: z.string().min(1),
    colorHex: ColorHexSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.type === "domain") {
      const result = DomainPatternSchema.safeParse(value.pattern);
      if (!result.success) {
        ctx.addIssue({ code: "custom", path: ["pattern"], message: result.error.issues[0]?.message ?? "Invalid domain" });
      }
    }
    if (value.type === "handle") {
      const result = HandlePatternSchema.safeParse(value.pattern);
      if (!result.success) {
        ctx.addIssue({ code: "custom", path: ["pattern"], message: result.error.issues[0]?.message ?? "Invalid handle" });
      }
    }
  });
export type SourceRuleCreate = z.infer<typeof SourceRuleCreateSchema>;

export const SourceRuleUpdateSchema = z
  .object({
    label: z.string().min(1).max(40).optional(),
    colorHex: ColorHexSchema.optional(),
    pattern: z.string().min(1).optional()
  })
  .strict();
export type SourceRuleUpdate = z.infer<typeof SourceRuleUpdateSchema>;






