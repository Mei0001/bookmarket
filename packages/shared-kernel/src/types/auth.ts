import { z } from "zod";

export const UserSettingsSchema = z.object({
  digestTime: z.string().regex(/^\d{2}:\d{2}$/).default("07:00"),
  locale: z.string().default("ja-JP"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  shareDefaults: z.boolean().default(true)
});

export const AuthProfileSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().nullable().optional(),
  tokens: z
    .object({
      accessToken: z.string().min(1),
      refreshToken: z.string().optional(),
      expiresAt: z.number().int()
    })
    .optional(),
  settings: UserSettingsSchema
});

export type AuthProfile = z.infer<typeof AuthProfileSchema>;

