# Implementation Plan: ブックマーク集約拡張の初期リリース

**Branch**: `001-aggregate-bookmarks` | **Date**: 2025-12-08 | **Spec**: [`specs/001-aggregate-bookmarks/spec.md`](./spec.md)  
**Input**: Feature specification from `/specs/001-aggregate-bookmarks/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Next.js(App Router) + TypeScript を用いたブラウザ拡張向けUIを構築し、対象ドメインのブックマーク同期・Googleログインによる設定同期・未読管理・ダイジェスト生成・Googleスプレッドシート出力を実現する。Chrome ブックマーク API と LocalStorage を活用してローカル優先のデータ保持を行い、Tailwind CSS でモジュラブルなUIを提供する。

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (Next.js 14 App Router on Node 18+)  
**Primary Dependencies**: Next.js(App Router), React 18, Tailwind CSS 3.x, NextAuth.js (Google Identity Services)  
**Storage**: Browser LocalStorage + Chrome bookmarks API cache; optional IndexedDB wrapper for queued exports  
**Testing**: Vitest + Testing Library for unit/UI, Playwright for extension-level smoke  
**Target Platform**: Chromium-based desktop browsers (Chrome/Edge) packaged as MV3 extension + optional standalone web UI  
**Project Type**: Web/extension hybrid (Next.js app exported to extension pages)  
**Performance Goals**: ブックマーク集約反映 ≤60秒、一覧操作応答 ≤2秒、ダイジェスト生成 ≤3秒  
**Constraints**: オフライン時はローカルキャッシュのみ、PIIを端末内に限定、リマインダー再通知上限5回  
**Scale/Scope**: 1ユーザーあたり対象ドメイン ≤10件、ブックマーク ≤1,000件、同時ユーザーは個別ローカル

**Open Questions / Research Prompts**

1. Next.js App Router を MV3 拡張機能に同梱するベストプラクティス（static export + chrome extension hosting）の最新手法  
2. 拡張機能内での Google OAuth（NextAuth vs Google Identity Services）の推奨構成とトークン保持方法  
3. ブログ/SNS の「いいね・ブックマーク数」取得手法（公式API／スクレイピング／キャッシュ戦略）の実現性  
4. LocalStorage/IndexedDB を組み合わせた同期ステータス・リマインダー永続化のベストプラクティス  
5. Tailwind CSS を拡張ポップアップ/オプションページに適用する際のビルド最適化

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` はプレースホルダ状態のため明示的な原則が未定義。暫定的に以下を前提に進行し、内容が更新された場合は再評価する。

- コア原則未定義 → 既存ドキュメントへの矛盾なし  
- 追加制約未定義 → 技術スタックはユーザー指定に従う  
- ガバナンス未定義 → プラン作成後に再チェック予定

**Gate Status**: PASS (仮) — 憲章未記載のため違反なし。Phase1完了後も再確認する。

**Post-Design Re-check (Phase1 完了後)**: 研究・データモデル・契約・クイックスタートはすべてユーザー指定スタックを遵守し、追加の複雑性導入なし。引き続き PASS。

## Project Structure

### Documentation (this feature)

```text
specs/001-aggregate-bookmarks/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
apps/
└── extension/                # Next.js App Router project
    ├── app/                  # Routes (popup, dashboard, options, api)
    ├── components/           # UI components (lists, filters, dialogs)
    ├── features/             # Domain-specific hooks, state machines
    ├── lib/                  # chrome/bookmark adapters, oauth helpers
    ├── styles/               # Tailwind config & layer overrides
    ├── public/               # Manifest v3, icons, static assets
    └── tests/
        ├── unit/
        ├── integration/
        └── e2e/              # Playwright extension tests

packages/
└── shared-kernel/            # (Optional) pure TS utilities (state, parsers)

tooling/
└── scripts/                  # build/export helpers for MV3 packaging
```

**Structure Decision**: 単一の Next.js App Router プロジェクトを `apps/extension` に配置し、将来的な共有ロジックを `packages/shared-kernel` に切り出せる構成を採用する。テスト/ビルド補助は `tooling/scripts` に集約し、MV3 用 manifest や service_worker を `public/` で管理する。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
