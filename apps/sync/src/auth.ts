import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// NOTE:
// env が無いと dev/build 自体が落ちるのを避ける（実際のサインイン時にエラーになる）。
const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          // refresh_token が必要になったとき用（最小実装でも付けておく）
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "google") {
        // Google の安定ID
        token.userId = account.providerAccountId;
        token.email = token.email ?? profile?.email;
        token.name = token.name ?? profile?.name;
        token.picture = token.picture ?? (profile as { picture?: string } | undefined)?.picture;

        if (account.access_token) token.providerAccessToken = account.access_token;
        if (account.refresh_token) token.providerRefreshToken = account.refresh_token;
        if (account.expires_at) token.providerExpiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      // NextAuth の型上は user.id が無いので、必要に応じて拡張する（現状は runtime で付与）
      if (session.user) {
        (session.user as { id?: string }).id = typeof token.userId === "string" ? token.userId : token.sub ?? undefined;
      }
      (session as { providerAccessToken?: string }).providerAccessToken =
        typeof token.providerAccessToken === "string" ? token.providerAccessToken : undefined;
      return session;
    },
  },
});

