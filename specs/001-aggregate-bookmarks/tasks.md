# Tasks: ブックマーク集約拡張の初期リリース

**Input**: Design documents from `/specs/001-aggregate-bookmarks/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: プロジェクトの骨格とビルド/実行環境を整える

- [ ] T001 Initialize pnpm workspace and root configs in `/Users/mei/bookmarket/bookmarket/package.json` と `pnpm-workspace.yaml`
- [ ] T002 Scaffold Next.js App Router project under `/Users/mei/bookmarket/bookmarket/apps/extension` with TypeScript & App Router enabled
- [ ] T003 Configure Tailwind CSS + PostCSS in `apps/extension/tailwind.config.ts` と `apps/extension/postcss.config.js`
- [ ] T004 Add lint/test tooling (ESLint, Vitest, Playwright) in `apps/extension/package.json`, `apps/extension/vitest.config.ts`, `apps/extension/playwright.config.ts`
- [ ] T005 Provision environment samples for OAuth/Sheets by editing `/Users/mei/bookmarket/bookmarket/.env.example` と `apps/extension/README.md`
- [ ] T006 Add Chrome MV3 manifest + service worker entry in `apps/extension/public/manifest.json` と `apps/extension/public/service-worker.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのユーザーストーリーが依存するコア層

- [ ] T007 Define shared domain types & zod schemas (SourceRule/BookmarkItem/AuthProfile) in `packages/shared-kernel/src/types/*.ts`
- [ ] T008 [P] Implement LocalStorage + IndexedDB persistence helpers per R-004 in `apps/extension/lib/storage/indexedDbClient.ts`
- [ ] T009 [P] Build Chrome bookmarks adapter & diff utilities in `apps/extension/lib/bookmarks/chromeBookmarksAdapter.ts`
- [ ] T010 Establish global layout/theme shell with Tailwind layers in `apps/extension/app/layout.tsx` と `apps/extension/styles/globals.css`
- [ ] T011 [P] Scaffold Next.js Route Handler tree (`apps/extension/app/api/health/route.ts`) and shared response utils `apps/extension/lib/api/response.ts`
- [ ] T012 Wire packaging script for MV3 (`tooling/scripts/pack-extension.ts`) referencing `next export` + manifest bundling

**Checkpoint**: ここまででUI/データ層/ビルドが整い、各ユーザーストーリーを独立に実装できる

---

## Phase 3: User Story 1 - 優先サイトのブックマークを一括把握 (Priority: P1) 🎯 MVP

**Goal**: 対象ドメイン登録・ブックマーク抽出・一覧表示 (FR-001〜FR-007)  
**Independent Test**: モック対象サイト2件を登録し、Chromeブックマークに保存→拡張ポップアップのフィルタ済み一覧が更新されるか確認

### Implementation

- [ ] T013 [P] [US1] Implement SourceRule store (CRUD + validation) in `apps/extension/features/sources/sourceRuleStore.ts`
- [ ] T014 [US1] Build Source management UI (add/edit/delete + domain helper) in `apps/extension/app/options/page.tsx`
- [ ] T015 [P] [US1] Create bookmark filtering + dedupe utilities in `apps/extension/lib/bookmarks/filterBySource.ts`
- [ ] T016 [US1] Implement sync scheduler hooking Chrome API + diff logic in `apps/extension/lib/bookmarks/syncScheduler.ts`
- [ ] T017 [P] [US1] Render aggregated list view with sorting, domain badges, timestamps in `apps/extension/app/(popup)/page.tsx`
- [ ] T018 [US1] Add bookmark card + empty state components in `apps/extension/components/bookmarks/BookmarkList.tsx` と `apps/extension/components/bookmarks/EmptyState.tsx`

**Parallel Example (US1)**:  
`T013` と `T015` は別モジュールのため並行対応可。UI系の `T017` と `T018` もデータ同期 `T016` 完了後に並列実装できる。

---

## Phase 4: User Story 2 - Googleアカウントで個別設定 (Priority: P2)

**Goal**: Google OAuthで設定同期・再ログイン復元 (FR-010, FR-011)  
**Independent Test**: テスト用Googleアカウントでサインイン→対象サイト設定を変更→再起動後も設定が復元されるか確認

### Implementation

- [ ] T019 [P] [US2] Configure NextAuth Google provider + session callbacks in `apps/extension/app/api/auth/[...nextauth]/route.ts`
- [ ] T020 [US2] Implement `chrome.identity.launchWebAuthFlow` bridge + token encryption in `apps/extension/lib/auth/launchWebAuthFlow.ts`
- [ ] T021 [P] [US2] Create authentication UI (signin button, user badge, error banner) in `apps/extension/components/auth/GoogleSignInButton.tsx` と `apps/extension/components/auth/UserBadge.tsx`
- [ ] T022 [US2] Persist AuthProfile + user settings in `apps/extension/features/auth/useAuthProfile.ts` leveraging `packages/shared-kernel/src/types/authProfile.ts`
- [ ] T023 [US2] Sync SourceRule/Bookmark state to user profile and restore on login in `apps/extension/lib/auth/syncUserSettings.ts`

**Parallel Example (US2)**:  
`T019`(API) と `T021`(UI) は契約が固まっていれば並列化でき、`T020` と `T022` はトークン保護と設定保存を同時に進められる。

---

## Phase 5: User Story 3 - 未読管理と再確認リマインド (Priority: P3)

**Goal**: ステータス切替とリマインダー設定/再通知 (FR-004, FR-005, FR-013)  
**Independent Test**: 未確認ブックマークをステータス変更→再読み込みして保持; リマインダー設定→5回上限で再通知されるか確認

### Implementation

- [ ] T024 [P] [US3] Extend bookmark state store with transitions + undo in `apps/extension/features/bookmarks/useBookmarkStatus.ts`
- [ ] T025 [US3] Implement ReviewReminder repository & scheduler (repeat count logic) in `apps/extension/lib/reminders/reminderStore.ts`
- [ ] T026 [P] [US3] Build reminder UI controls (toggle, snooze form) in `apps/extension/components/reminders/ReminderToggle.tsx`
- [ ] T027 [US3] Hook reminder alarms + digest notification bridge in `apps/extension/public/service-worker.ts`
- [ ] T028 [P] [US3] Add status filter tabs + visual indicators in `apps/extension/components/bookmarks/StatusFilterTabs.tsx`

**Parallel Example (US3)**:  
`T024`（ロジック）と `T026`（UI）はAPI契約が明確なら並列可能。`T025` 完了後に `T027` を連動させ、UI側 `T028` は独立実装できる。

---

## Phase 6: User Story 4 - 朝のダイジェスト確認 (Priority: P4)

**Goal**: 社会的指標スコアリング、ダイジェスト生成、共有/エクスポート (FR-008, FR-009, FR-012, FR-014)  
**Independent Test**: 未確認10件を用意→ダイジェスト生成で優先度順と件数が表示され、エクスポートでGoogle Sheetsへ送信/共有文面コピーが成功するか確認

### Implementation

- [ ] T029 [P] [US4] Implement social signal providers (Qiita/Note/Hatena/X) with caching in `apps/extension/features/social-signals/providers/*.ts`
- [ ] T030 [US4] Add score calculator + priority ranking helper in `packages/shared-kernel/src/social/scoreCalculator.ts`
- [ ] T031 [P] [US4] Build digest generator + snapshot persistence in `apps/extension/lib/digest/generateDigest.ts`
- [ ] T032 [US4] Create digest dashboard UI with summaries & reminder highlights in `apps/extension/app/(dashboard)/digest/page.tsx`
- [ ] T033 [P] [US4] Implement share/copy CTA component in `apps/extension/components/digest/DigestShareButton.tsx`
- [ ] T034 [US4] Build Google Sheets export route handler + Sheets API client in `apps/extension/app/api/export/google-sheets/route.ts`
- [ ] T035 [US4] Add export orchestration UI + status polling in `apps/extension/components/export/SheetExportButton.tsx`

**Parallel Example (US4)**:  
`T029` と `T030` はデータ収集/スコア計算を同時進行可能。`T031` 完了後に UI (`T032`, `T033`, `T035`) と API (`T034`) を並列で進められる。

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T036 [P] Harden error states + offline banners across `apps/extension/components/*`
- [ ] T037 Document runbooks & update `specs/001-aggregate-bookmarks/quickstart.md` with any command changes
- [ ] T038 Execute regression pass (lint, vitest, playwright, manual bookmark sync) per quickstart and capture results in `specs/001-aggregate-bookmarks/checklists/requirements.md`

---

## Dependencies & Execution Order

1. **Phase 1 → Phase 2**: Setup完了後に基盤整備へ進む。  
2. **Phase 2 → User Stories**: Foundational完了でUS1〜US4を着手可。  
3. **User Stories**: 原則 P1 → P2 → P3 → P4 の順。US2〜US4はFoundational完了後に並列化可だが、US1の一覧UIが基盤となるため先行推奨。  
4. **Phase 7**: すべての対象ストーリーが揃った後に実施。

### Story Dependency Highlights
- **US1**: 以降のストーリーが再利用する一覧/Source基盤のため最優先。  
- **US2**: US1のSource/Bookmark状態を引き継ぐが、Foundational完了後なら並列化可能。  
- **US3**: Bookmark状態管理完成後に着手。US1のカード/ストアを利用。  
- **US4**: Social signalsはUS1のデータを基にスコアリング。リマインダー情報（US3）と連携するため最後。

### Parallel Opportunities
- Setup/Foundationalの [P] タスクは別ファイルで並行作業可。  
- 各ユーザーストーリーの「Parallel Example」を参照し、UI/ロジック/外部連携を役割分担できる。  
- US2, US3, US4 はFoundational完了後に個別チームで同時進行可（ただしUS1成果物への参照が必要）。

---

## Implementation Strategy

### MVP (User Story 1)
1. Phase 1〜2を完了し、同期パイプラインとUIシェルを確立。  
2. Phase 3（US1）で対象サイト登録〜一覧表示を仕上げ、モックデータで検証。  
3. ここで一旦配布し、ブックマーク集約体験を確認。

### Incremental Delivery
1. **US2**: 認証/同期 → マルチデバイス価値を提供。  
2. **US3**: 未読管理/リマインダーで行動喚起を強化。  
3. **US4**: ダイジェストとエクスポートで外部共有を実現。  
各ステップ後に独立テストを実施し、必要なら早期デプロイ。

### Parallel Team Allocation
- チームA: ブックマーク同期 + UI (US1)  
- チームB: 認証/設定同期 (US2)  
- チームC: リマインダー + ダイジェスト/エクスポート (US3/US4)  
共通ライブラリ/ストレージは Phase2 完了後に安定化させ、コンフリクトを最小化する。
# Tasks: ブックマーク集約拡張の初期リリース

**Input**: Design documents from `/specs/001-aggregate-bookmarks/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story (US1–US4) to keep each slice independently testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: プロジェクトの骨格構築とビルド環境の用意

- [ ] T001 Initialize Next.js App Router workspace and pnpm setup in `apps/extension/package.json` and root `pnpm-workspace.yaml`
- [ ] T002 Configure Tailwind CSS + PostCSS pipeline in `apps/extension/tailwind.config.ts`, `postcss.config.js`, and `app/globals.css`
- [ ] T003 Add Chrome MV3 manifest, icons, and packaging script in `apps/extension/public/manifest.json` and `tooling/scripts/build-extension.ts`
- [ ] T004 Configure lint/test tooling (ESLint, Vitest, Playwright) in `apps/extension/.eslintrc.json`, `vitest.config.ts`, and `playwright.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのユーザーストーリーを支えるコア基盤  
**⚠️ CRITICAL**: このフェーズ完了前にユーザーストーリー作業を開始しない

- [ ] T005 Implement Chrome bookmarks adapter + event listeners in `apps/extension/lib/chrome/bookmarksAdapter.ts`
- [ ] T006 Build LocalStorage + IndexedDB persistence client with `idb` helper in `apps/extension/lib/storage/indexedDbClient.ts`
- [ ] T007 Create shared state container (e.g., Zustand) for SourceRule/Bookmark context in `apps/extension/features/core/appStore.ts`
- [ ] T008 Implement MV3 service-worker messaging bridge for Next.js pages in `apps/extension/public/service-worker.ts` and `apps/extension/lib/chrome/runtimeBridge.ts`
- [ ] T009 Scaffold popup/dashboard/options layouts with navigation shell in `apps/extension/app/(popup)/layout.tsx` and `apps/extension/app/options/layout.tsx`

**Checkpoint**: ここまでで同期・保存・UIフレームが利用可能

---

## Phase 3: User Story 1 - 優先サイトのブックマークを一括把握 (Priority: P1) 🎯 MVP

**Goal**: 対象ドメインの登録と、抽出済みブックマーク一覧を最新順で表示  
**Independent Test**: 対象サイトを2件登録 → ブックマークを追加 → Popup で対象のみが最新順に並び、空状態メッセージも確認できること

- [ ] T010 [P] [US1] Define `SourceRule`/`BookmarkItem` schemas & validation in `apps/extension/features/bookmarks/bookmark.types.ts`
- [ ] T011 [P] [US1] Implement SourceRule CRUD hooks backed by persistence layer in `apps/extension/features/sources/sourceRule.store.ts`
- [ ] T012 [US1] Build Source management UI (create/edit/delete) in `apps/extension/app/options/sources/page.tsx`
- [ ] T013 [US1] Implement bookmark sync + filtering pipeline in `apps/extension/lib/bookmarks/sync.ts` using SourceRule patterns
- [ ] T014 [US1] Render aggregated bookmark list with filters/empty state handling in `apps/extension/app/(popup)/page.tsx`
- [ ] T015 [US1] Expose `/api/bookmarks/route.ts` to serve filtered lists per `contracts/openapi.yaml`

**Checkpoint**: US1 のみで集約ビューを配布可能（MVP）

---

## Phase 4: User Story 2 - Googleアカウントで個別設定 (Priority: P2)

**Goal**: Googleログイン＋個別設定同期（SourceRule/ステータス）  
**Independent Test**: Google でサインイン → 設定を変更 → サインアウト/再ログイン後も設定が復元される

- [ ] T016 [P] [US2] Configure NextAuth Google provider + callbacks in `apps/extension/app/api/auth/[...nextauth]/route.ts`
- [ ] T017 [P] [US2] Implement `chrome.identity.launchWebAuthFlow` bridge in `apps/extension/lib/auth/chromeIdentityBridge.ts`
- [ ] T018 [US2] Persist `AuthProfile` + user settings with encryption helpers in `apps/extension/features/auth/authProfile.store.ts`
- [ ] T019 [US2] Add sign-in/out UI and profile indicator in `apps/extension/components/auth/GoogleSignInButton.tsx` and integrate into popup layout
- [ ] T020 [US2] Create `/api/user-settings/route.ts` to load/save SourceRule/Bookmark preferences per authenticated user

---

## Phase 5: User Story 3 - 未読管理と再確認リマインド (Priority: P3)

**Goal**: ブックマークの状態切替と最大5回のリマインダー運用  
**Independent Test**: リストから未確認→確認済みへ切替／翌朝リマインダー設定 → ステータスが永続化され、再読み込みでも保持される

- [ ] T021 [P] [US3] Extend bookmark status state machine + ReviewReminder types in `apps/extension/features/bookmarks/statusMachine.ts`
- [ ] T022 [US3] Add status toggle & snooze controls to `apps/extension/components/bookmarks/BookmarkCard.tsx`
- [ ] T023 [US3] Implement reminder repository with repeat-count guard in `apps/extension/features/reminders/reminder.store.ts`
- [ ] T024 [US3] Provide `/api/reminders/route.ts` for create/update/cancel operations per contract
- [ ] T025 [US3] Persist status/reminder metadata to IndexedDB & sync to session in `apps/extension/lib/storage/bookmarkStatusPersistence.ts`
- [ ] T026 [US3] Surface reminder highlights + due list in `apps/extension/app/(popup)/page.tsx`

---

## Phase 6: User Story 4 - 朝のダイジェスト確認 (Priority: P4)

**Goal**: 社会的指標による優先度推定とダイジェスト要約＋共有/エクスポート  
**Independent Test**: 未確認10件＋シグナル付きデータでダイジェストが生成され、共有コピーとSheetsエクスポートが成功する

- [ ] T027 [P] [US4] Implement social-signal adapters per service in `apps/extension/features/social/socialSignal.service.ts`
- [ ] T028 [P] [US4] Build digest scoring engine + snapshot generator in `apps/extension/features/digest/digestEngine.ts`
- [ ] T029 [US4] Create digest UI (counts, top3, reminders) with copy-to-clipboard CTA in `apps/extension/app/digest/page.tsx`
- [ ] T030 [US4] Implement `/api/digest/route.ts` returning `DigestSnapshot` payload per openapi contract
- [ ] T031 [US4] Build Google Sheets export API in `apps/extension/app/api/export/google-sheets/route.ts`
- [ ] T032 [US4] Add export/clipboard triggers + job status UI in `apps/extension/app/(popup)/export-card.tsx`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 仕上げと横断的改善

- [ ] T033 [P] Add instrumentation/logging + error toasts across `apps/extension/lib/logger.ts` and shared components
- [ ] T034 Update documentation (`specs/001-aggregate-bookmarks/quickstart.md` and README) to reflect auth/export setup
- [ ] T035 Run end-to-end packaging rehearsal via `tooling/scripts/build-extension.ts` and validate Chrome sideload

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 → Phase 2** → US1 → US2 → US3 → US4 → Polish (順次、ただし Foundational 完了後は US2–US4 を並列開始可)

### User Story Dependencies
- **US1**: Depends on Phase 2 completionのみ
- **US2**: Depends on Phase 2 (NextAuth bridge) and reuses SourceRule persistence from US1
- **US3**: Depends on US1 (bookmark list) for status UI; reminder APIは独立
- **US4**: Depends on US1 (bookmark data) + US3 (status/reminder) forダイジェスト指標

### Parallel Opportunities
- [Setup] T002–T004 は T001 完了後に並列可
- [Foundational] T005–T009 は各ファイルが独立しており [P] 指定なしでも別担当で並列可能
- [US1] T010/T011 は並列で進め、その後 T012–T015 を順次
- [US2] T016/T017 は並列、T018 以降は順次
- [US3] T021/T022/T023 を並列、API(T024)と永続化(T025)は依存関係に従う
- [US4] T027/T028/T031 を並列、UI系(T029/T032)はエンジン完成後
- Polish フェーズは全ストーリー完了後に並列処理可能

---

## Parallel Examples

### User Story 1
```bash
# Domain + store並列
Task T010 (schemas) & Task T011 (store) in parallel
# UIとAPIを分担
Task T014 (popup UI) || Task T015 (API route)
```

### User Story 2
```bash
# 認証基盤
Task T016 (NextAuth config) || Task T017 (chrome identity bridge)
# 状態同期
Task T018 (AuthProfile store) -> Task T020 (settings API)
```

### User Story 3
```bash
# 状態とリマインドを並列実装
Task T021 (status machine) || Task T023 (reminder repo)
# UIとAPIを同時開発
Task T022 (UI controls) || Task T024 (reminder API)
```

### User Story 4
```bash
# スコアリングとシグナル収集を並列
Task T027 (social adapters) || Task T028 (digest engine)
# エクスポート系
Task T031 (Sheets API) || Task T032 (export UI card)
```

---

## Implementation Strategy

### MVP First (US1)
1. 完了: Phase 1–2  
2. Phase 3 (US1) 実装 → 集約リスト単体で検証  
3. Popup で表示確認後、MVP として共有

### Incremental Delivery
1. US2 で Google 認証を追加 → 設定同期を検証  
2. US3 で未読管理 + リマインド → フロー試験後リリース  
3. US4 でダイジェスト/エクスポート → 最終リリース

### Parallel Team Strategy
- 開発者A: US1 → US3 UI  
- 開発者B: 認証 + エクスポート API  
- 開発者C: ソーシャルシグナル + Digest Engine  
- 週次で Popup UI に統合し相互依存を解消

---

## Notes
- すべてのタスクにファイルパスを明記し、PR単位で管理  
- [USx] ラベルにより各ストーリーの完結性を追跡  
- Quickstart.md の手順に沿ってローカル検証を行い、Playwright で主要シナリオを確認  
- いつでも Phase checkpoint で停止し、独立価値を提供できるようにする

