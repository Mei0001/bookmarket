import type { AuthProfile } from "@bookmarket/shared-kernel";
import { base64urlDecodeToString } from "@/lib/auth/base64";

function isExtensionIdentityAvailable(): boolean {
  return typeof chrome !== "undefined" && !!chrome.identity?.launchWebAuthFlow && !!chrome.identity?.getRedirectURL;
}

function parseHashParams(urlString: string): Record<string, string> {
  const u = new URL(urlString);
  const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
  const params = new URLSearchParams(hash);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export async function signInWithGoogleViaLaunchWebAuthFlow(params: { syncBaseUrl: string }) {
  if (!isExtensionIdentityAvailable()) {
    throw new Error("chrome.identity.launchWebAuthFlow is not available (not running as an extension).");
  }

  const redirectUri = chrome.identity.getRedirectURL("bookmarket");
  const startUrl = `${params.syncBaseUrl.replace(/\/$/, "")}/ext/start?redirect_uri=${encodeURIComponent(redirectUri)}`;

  const finalUrl = await chrome.identity.launchWebAuthFlow({
    url: startUrl,
    interactive: true,
  });
  if (!finalUrl) throw new Error("launchWebAuthFlow returned empty URL.");

  const hash = parseHashParams(finalUrl);
  if (hash.error) throw new Error(hash.error);
  if (!hash.token || !hash.profile) throw new Error("Missing token/profile in callback URL.");

  const profileJson = base64urlDecodeToString(hash.profile);
  const profile = JSON.parse(profileJson) as Pick<AuthProfile, "userId" | "email" | "displayName" | "avatarUrl">;

  return {
    token: hash.token,
    profile: {
      ...profile,
      settings: {
        digestTime: "07:00",
        locale: "ja-JP",
        theme: "system",
        shareDefaults: true,
      },
    } as Omit<AuthProfile, "tokens">,
  };
}

