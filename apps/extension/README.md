## Getting Started

```bash
# from repo root
pnpm install
pnpm dev
```

The dev server runs on [http://localhost:3000](http://localhost:3000). The App Router auto-updates when you edit files under `app/`.

### Environment

Copy `.env.example` at the repo root:

```bash
cp .env.example .env.local
```

Populate Google OAuth / NextAuth / Sheets credentials before running protected flows.

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
