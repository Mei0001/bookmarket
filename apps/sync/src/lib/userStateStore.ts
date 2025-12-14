import type { BookmarkItem, SourceRule } from "@bookmarket/shared-kernel";
import { AuthProfileSchema, UserSettingsSchema, SourceRuleSchema, BookmarkItemSchema } from "@bookmarket/shared-kernel";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const UserStateSchema = z.object({
  profile: AuthProfileSchema.omit({ tokens: true }),
  settings: UserSettingsSchema,
  sourceRules: z.array(SourceRuleSchema),
  bookmarks: z.array(BookmarkItemSchema),
  updatedAt: z.string().datetime(),
});

export type UserState = z.infer<typeof UserStateSchema>;

const dataDir = () => join(process.cwd(), ".data", "userState");
const fileForUser = (userId: string) => join(dataDir(), `${encodeURIComponent(userId)}.json`);

export async function loadUserState(userId: string): Promise<UserState | null> {
  try {
    const raw = await readFile(fileForUser(userId), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const result = UserStateSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

export async function saveUserState(userId: string, state: Omit<UserState, "updatedAt">): Promise<UserState> {
  await mkdir(dataDir(), { recursive: true });
  const next: UserState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(fileForUser(userId), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function normalizeIncomingState(params: {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  settings?: unknown;
  sourceRules?: unknown;
  bookmarks?: unknown;
}) {
  const settings = UserSettingsSchema.parse(params.settings ?? {});
  const sourceRules = z.array(SourceRuleSchema).parse(params.sourceRules ?? []);
  const bookmarks = z.array(BookmarkItemSchema).parse(params.bookmarks ?? []);

  // サーバー側で userId を強制的に紐付ける（クライアントが別 userId を送っても無視）
  const normalizedSourceRules: SourceRule[] = sourceRules.map((r) => ({ ...r, userId: params.userId }));

  // BookmarkItem には userId は無いが、ID等はクライアント由来。最小ではそのまま受け入れる。
  const normalizedBookmarks: BookmarkItem[] = bookmarks;

  const profile = AuthProfileSchema.omit({ tokens: true }).parse({
    userId: params.userId,
    email: params.email,
    displayName: params.name ?? params.email,
    avatarUrl: params.picture ?? null,
    settings,
  });

  return { profile, settings, sourceRules: normalizedSourceRules, bookmarks: normalizedBookmarks };
}

