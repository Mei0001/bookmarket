import type { AuthProfile } from "@bookmarket/shared-kernel";
import { AuthProfileSchema, UserSettingsSchema } from "@bookmarket/shared-kernel";
import { decryptString, encryptString, type EncryptedPayloadV1 } from "@/lib/auth/crypto";
import { storageGet, storageRemove, storageSet } from "@/lib/auth/extensionStorage";

const TOKEN_KEY = "bookmarket:auth:extToken:v1";
const PROFILE_KEY = "bookmarket:auth:profile:v1";

type StoredEncrypted = EncryptedPayloadV1;

export async function saveAuthSession(params: { token: string; profile: Omit<AuthProfile, "tokens"> }) {
  const profile = AuthProfileSchema.omit({ tokens: true }).parse({
    ...params.profile,
    settings: UserSettingsSchema.parse((params.profile as { settings?: unknown }).settings ?? {}),
  });

  const encToken = await encryptString(params.token);
  const encProfile = await encryptString(JSON.stringify(profile));

  await storageSet(TOKEN_KEY, encToken);
  await storageSet(PROFILE_KEY, encProfile);
}

export async function loadAuthSession(): Promise<{ token: string; profile: Omit<AuthProfile, "tokens"> } | null> {
  const tokenPayload = await storageGet<StoredEncrypted>(TOKEN_KEY);
  const profilePayload = await storageGet<StoredEncrypted>(PROFILE_KEY);
  if (!tokenPayload || !profilePayload) return null;

  try {
    const token = await decryptString(tokenPayload);
    const profileRaw = await decryptString(profilePayload);
    const profile = AuthProfileSchema.omit({ tokens: true }).parse(JSON.parse(profileRaw));
    return { token, profile };
  } catch (error) {
    console.warn("[auth] failed to decrypt stored session; clearing", error);
    await clearAuthSession();
    return null;
  }
}

export async function clearAuthSession() {
  await storageRemove(TOKEN_KEY);
  await storageRemove(PROFILE_KEY);
}

