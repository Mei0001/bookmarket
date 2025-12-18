import type { SourceRule, SourceRuleCreate, SourceRuleUpdate } from "@bookmarket/shared-kernel";
import { SourceRuleCreateSchema, SourceRuleSchema, SourceRuleUpdateSchema } from "@bookmarket/shared-kernel";
import { deleteSourceRule, getAllSourceRules, persistSourceRule } from "@/lib/storage/indexedDbClient";
import { useEffect, useMemo, useSyncExternalStore } from "react";

type Listener = () => void;

let cache: SourceRule[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

async function ensureLoaded() {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      cache = await getAllSourceRules();
      loaded = true;
      notify();
    })().finally(() => {
      loadPromise = null;
    });
  }
  await loadPromise;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cache;
}

function generateId(prefix = "sr") {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return `${prefix}_${(globalThis.crypto as any).randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function pickDefaultColorHex() {
  const palette = ["#0EA5E9", "#22C55E", "#A855F7", "#F97316", "#EF4444", "#14B8A6", "#EAB308"] as const;
  return palette[Math.floor(Math.random() * palette.length)] ?? "#0EA5E9";
}

export function useSourceRules() {
  useEffect(() => {
    void ensureLoaded();
  }, []);

  const rules = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const sorted = useMemo(() => [...rules].sort((a, b) => a.label.localeCompare(b.label, "ja")), [rules]);

  return {
    loaded,
    rules: sorted,
    async reload() {
      cache = await getAllSourceRules();
      loaded = true;
      notify();
    },
    async create(input: SourceRuleCreate) {
      const result = SourceRuleCreateSchema.safeParse(input);
      if (!result.success) {
        throw new Error(result.error.issues[0]?.message ?? "Invalid SourceRule");
      }

      const next: SourceRule = {
        id: generateId(),
        userId: "local",
        label: result.data.label.trim(),
        type: result.data.type,
        pattern: result.data.pattern.trim(),
        colorHex: result.data.colorHex ?? pickDefaultColorHex(),
        syncStatus: "idle",
        lastSyncedAt: null,
        errorMessage: null
      };

      const normalized = SourceRuleSchema.parse(next);
      await persistSourceRule(normalized);
      cache = [...cache, normalized];
      notify();
      return normalized;
    },
    async update(id: string, patch: SourceRuleUpdate) {
      const result = SourceRuleUpdateSchema.safeParse(patch);
      if (!result.success) {
        throw new Error(result.error.issues[0]?.message ?? "Invalid update");
      }

      const current = cache.find((r) => r.id === id);
      if (!current) throw new Error("SourceRule not found");

      const merged: SourceRule = SourceRuleSchema.parse({
        ...current,
        ...result.data,
        label: result.data.label ? result.data.label.trim() : current.label,
        pattern: result.data.pattern ? result.data.pattern.trim() : current.pattern
      });

      await persistSourceRule(merged);
      cache = cache.map((r) => (r.id === id ? merged : r));
      notify();
      return merged;
    },
    async remove(id: string) {
      await deleteSourceRule(id);
      cache = cache.filter((r) => r.id !== id);
      notify();
    }
  };
}

