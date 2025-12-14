## Getting Started

```bash
# from repo root
pnpm install
pnpm dev
```

The dev server runs on [http://localhost:3000](http://localhost:3000). The App Router auto-updates when you edit files under `src/app/`.

### Environment

Copy `.env.example` at the repo root into `apps/extension/.env.local`:

```bash
cp .env.example apps/extension/.env.local
```

Populate Google OAuth / NextAuth / Sheets credentials before running protected flows (US2/US4).

#### Required (for OAuth / Sheets flows)

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SHEETS_SERVICE_ACCOUNT_KEY`

#### Optional (depending on flow)

- `GOOGLE_REDIRECT_URI` (explicit callback URL)
- `CHROME_EXTENSION_ID` / `CHROME_AUTH_REDIRECT_URI` (when using `chrome.identity.launchWebAuthFlow`)
- `SHEETS_SERVICE_ACCOUNT_EMAIL` / `SHEETS_TARGET_SPREADSHEET_ID` (export defaults)

Example value style for service account JSON:

```env
SHEETS_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

### Workspace Commands

```bash
pnpm dev            # apps/extension dev server
pnpm build          # production build
pnpm lint           # ESLint
pnpm test:unit      # Vitest (configured later)
pnpm test:e2e       # Playwright (configured later)
pnpm pack:extension # next export + MV3 bundling script
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
