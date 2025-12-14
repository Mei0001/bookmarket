import { base64Decode, base64Encode } from "@/lib/auth/base64";
import { storageGet, storageSet } from "@/lib/auth/extensionStorage";

const KEY_MATERIAL_STORAGE_KEY = "bookmarket:auth:keyMaterial:v1";

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // TS の Uint8Array<ArrayBufferLike> 問題を避けるため明示変換
  const buf = u8.buffer as ArrayBuffer;
  return buf.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

async function getOrCreateKeyMaterial(): Promise<Uint8Array> {
  const existing = await storageGet<string>(KEY_MATERIAL_STORAGE_KEY);
  if (existing) return base64Decode(existing);

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("WebCrypto is not available (crypto.getRandomValues).");
  }
  const material = new Uint8Array(32);
  crypto.getRandomValues(material);
  await storageSet(KEY_MATERIAL_STORAGE_KEY, base64Encode(material));
  return material;
}

async function getAesGcmKey(): Promise<CryptoKey> {
  const material = await getOrCreateKeyMaterial();
  return crypto.subtle.importKey("raw", toArrayBuffer(material), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export type EncryptedPayloadV1 = {
  v: 1;
  alg: "A256GCM";
  iv: string; // base64
  ct: string; // base64
};

export async function encryptString(plain: string): Promise<EncryptedPayloadV1> {
  if (!globalThis.crypto?.subtle) throw new Error("WebCrypto is not available (crypto.subtle).");
  const key = await getAesGcmKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(new TextEncoder().encode(plain))
  );
  return { v: 1, alg: "A256GCM", iv: base64Encode(iv), ct: base64Encode(new Uint8Array(ciphertext)) };
}

export async function decryptString(payload: EncryptedPayloadV1): Promise<string> {
  if (payload.v !== 1 || payload.alg !== "A256GCM") throw new Error("Unsupported encrypted payload");
  const key = await getAesGcmKey();
  const iv = base64Decode(payload.iv);
  const ct = base64Decode(payload.ct);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(ct));
  return new TextDecoder().decode(new Uint8Array(plaintext));
}

