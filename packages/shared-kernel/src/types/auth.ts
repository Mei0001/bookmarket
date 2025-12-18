import { z } from "zod";

export const UserSettingsSchema = z.object({
  // openapi.yaml は ^[0-2][0-9]:[0-5][0-9]$ だが、実質的に 00-23 を許可する
  digestTime: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/).default("07:00"),
  locale: z.string().default("ja-JP"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  shareDefaults: z.boolean().default(true)
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

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
