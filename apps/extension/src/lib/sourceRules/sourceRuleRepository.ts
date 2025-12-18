import {
  SourceRuleCreateSchema,
  SourceRuleSchema,
  SourceRuleUpdateSchema,
  type SourceRule,
  type SourceRuleCreate,
  type SourceRuleUpdate
} from "@bookmarket/shared-kernel";

import { deleteSourceRules, getAllSourceRules, getSourceRule, persistSourceRules } from "@/lib/storage/indexedDbClient";

const DEFAULT_COLOR = "#2563eb";
const LOCAL_USER_ID = "local";

function randomId(prefix = "sr") {
  if (typeof globalThis.crypto?.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase();
}

export async function listSourceRules(): Promise<SourceRule[]> {
  const rules = await getAllSourceRules();
  return [...rules].sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

export async function listSourceRulesByUser(userId: string): Promise<SourceRule[]> {
  const rules = await getAllSourceRules();
  return rules.filter((r) => r.userId === userId).sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

export async function createSourceRule(input: SourceRuleCreate, options?: { userId?: string }): Promise<SourceRule> {
  const parsed = SourceRuleCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid SourceRule");
  }

  if (parsed.data.type !== "domain") {
    throw new Error("MVPでは domain のみ対応しています。");
  }

  const candidate: SourceRule = {
    id: randomId(),
    userId: options?.userId ?? LOCAL_USER_ID,
    label: parsed.data.label.trim(),
    type: parsed.data.type,
    pattern: normalizeDomain(parsed.data.pattern),
    colorHex: parsed.data.colorHex ?? DEFAULT_COLOR,
    syncStatus: "idle",
    lastSyncedAt: null,
    errorMessage: null
  };

  const validated = SourceRuleSchema.parse(candidate);
  await persistSourceRules([validated]);
  return validated;
}

export async function updateSourceRule(id: string, patch: SourceRuleUpdate): Promise<SourceRule> {
  const parsedPatch = SourceRuleUpdateSchema.safeParse(patch);
  if (!parsedPatch.success) {
    throw new Error(parsedPatch.error.issues[0]?.message ?? "Invalid SourceRule update");
  }

  const existing = await getSourceRule(id);
  if (!existing) throw new Error("SourceRule not found");

  const next: SourceRule = {
    ...existing,
    ...parsedPatch.data,
    label: parsedPatch.data.label ? parsedPatch.data.label.trim() : existing.label,
    pattern: parsedPatch.data.pattern ? normalizeDomain(parsedPatch.data.pattern) : existing.pattern
  } as SourceRule;

  const validated = SourceRuleSchema.parse(next);
  await persistSourceRules([validated]);
  return validated;
}

export async function deleteSourceRule(id: string): Promise<void> {
  await deleteSourceRules([id]);
}

export async function setSourceRuleSyncStatus(
  id: string,
  patch: { syncStatus: SourceRule["syncStatus"]; lastSyncedAt?: string | null; errorMessage?: string | null }
) {
  const existing = await getSourceRule(id);
  if (!existing) return;
  const next: SourceRule = {
    ...existing,
    syncStatus: patch.syncStatus,
    lastSyncedAt: patch.lastSyncedAt ?? existing.lastSyncedAt,
    errorMessage: patch.errorMessage ?? existing.errorMessage ?? null
  };
  const validated = SourceRuleSchema.parse(next);
  await persistSourceRules([validated]);
  return validated;
}

