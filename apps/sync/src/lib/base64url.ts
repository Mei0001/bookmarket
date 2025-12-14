export function base64urlEncode(input: Uint8Array): string {
  const base64 = Buffer.from(input).toString("base64");
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function base64urlEncodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  return base64urlEncode(new TextEncoder().encode(json));
}

