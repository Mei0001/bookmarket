# Bookmarket Aggregator

Chromium 拡張として動作するブックマーク集約 / リマインダー体験を作るための Next.js App Router + pnpm モノレポです。  
`specs/001-aggregate-bookmarks/` に仕様・計画・研究がまとまっており、`apps/extension` が実装対象、`packages/shared-kernel` がドメイン型を提供します。

## ディレクトリ構成

```
apps/
  extension/         # Next.js App Router + MV3 ホスト UI
packages/
  shared-kernel/     # zod スキーマとドメイン型
specs/001-aggregate-bookmarks/
  spec.md            # 仕様
  plan.md            # 実装計画
  tasks.md           # タスク分解
tooling/
  scripts/pack-extension.ts   # next export + MV3 パッケージング
```

## セットアップ

```bash
pnpm install
cp .env.example apps/extension/.env.local   # Google OAuth / Sheets 連携などの値を設定
```

### 開発サーバ

```bash
pnpm dev     # apps/extension を起動 (http://localhost:3000)
```

### Lint / Test

```bash
pnpm lint        # ESLint
pnpm test:unit   # Vitest
pnpm test:e2e    # Playwright（将来有効化）
```

### MV3 向けバンドル

```bash
pnpm pack:extension
```

`dist/extension` に出力されたファイルを `chrome://extensions` で「パッケージ化されていない拡張機能」として読み込むと、現在の UI を Chrome 拡張として確認できます。

## ワークツリーでの並列開発

以下の worktree ブランチが既に追加済みです。各ストーリーごとに `../bookmarket-usX` を別ウィンドウで開くと衝突を減らせます。

| Story | Branch | Path |
|-------|--------|------|
| US1   | `001-aggregate-bookmarks-us1` | `../bookmarket-us1` |
| US2   | `001-aggregate-bookmarks-us2` | `../bookmarket-us2` |
| US3   | `001-aggregate-bookmarks-us3` | `../bookmarket-us3` |
| US4   | `001-aggregate-bookmarks-us4` | `../bookmarket-us4` |

## 参考

- 仕様: `specs/001-aggregate-bookmarks/spec.md`
- 実装計画: `specs/001-aggregate-bookmarks/plan.md`
- タスク: `specs/001-aggregate-bookmarks/tasks.md`

