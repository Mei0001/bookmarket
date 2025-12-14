import { SignJWT, jwtVerify } from "jose";

export type ExtensionTokenClaims = {
  sub: string; // userId
  email: string;
  name?: string;
  picture?: string;
  aud: "bookmarket-extension";
};

function getJwtSecret() {
  const raw = process.env.EXT_TOKEN_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!raw) throw new Error("Missing EXT_TOKEN_SECRET (or AUTH_SECRET/NEXTAUTH_SECRET) for signing extension tokens.");
  return new TextEncoder().encode(raw);
}

export async function signExtensionToken(params: {
  userId: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  expiresIn?: string; // e.g. "30d"
}) {
  const { userId, email, name, picture } = params;
  const expiresIn = params.expiresIn ?? "30d";

  return new SignJWT({
    email,
    name: name ?? undefined,
    picture: picture ?? undefined,
    aud: "bookmarket-extension",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

export async function verifyExtensionToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    audience: "bookmarket-extension",
  });
  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== "string") throw new Error("Invalid token: missing sub");
  if (typeof email !== "string") throw new Error("Invalid token: missing email");
  return {
    userId: sub,
    email,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

