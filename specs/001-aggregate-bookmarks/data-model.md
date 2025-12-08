# Data Model: ブックマーク集約拡張

## Entity Overview

| Entity | Description | Relationships |
|--------|-------------|---------------|
| `SourceRule` | ユーザーが登録した監視対象ドメイン/ハンドル。同期対象を限定するフィルタ。 | 1:N `BookmarkItem` |
| `BookmarkItem` | 抽出済みブックマークレコード。ステータスや社会的指標を保持。 | N:1 `SourceRule`, 1:0..1 `ReviewReminder`, 1:0..1 `SocialSignal` |
| `ReviewReminder` | 特定ブックマークの再確認計画。再通知回数を管理。 | 1:1 `BookmarkItem` |
| `SocialSignal` | いいね数/ブックマーク数などのメタ指標。 | 1:1 `BookmarkItem` |
| `DigestSnapshot` | 指定時間に生成したダイジェストメタデータ。 | 集計元: `BookmarkItem`(複数) |
| `AuthProfile` | Google アカウント認証情報と同期設定。 | 1:N `SourceRule`, `BookmarkItem` |
| `ExportJob` | Google スプレッドシートへのエクスポート履歴。 | 参照: `BookmarkItem` IDs |

---

## SourceRule
- **Fields**
  - `id: string` (ULID) — ローカルでユニーク
  - `userId: string` — `AuthProfile.userId` と関連（匿名モードでは `local` 固定）
  - `label: string` — 表示名（1〜40文字）
  - `type: "domain" | "handle"` — ブログURLかSNSハンドルか
  - `pattern: string` — ドメイン名 or ハンドル
  - `colorHex: string` — UI表示用（`#RRGGBB`）
  - `syncStatus: "idle" | "syncing" | "error"`
  - `lastSyncedAt: ISOString | null`
  - `errorMessage?: string`
- **Validation**
  - `pattern` はドメイン形式 or `@handle` 形式
  - 最大登録数 10
- **State changes**
  - Create→Syncing→Idle/Error（同期開始/完了/失敗）

## BookmarkItem
- **Fields**
  - `id: string` (Chrome bookmark ID または自生成)
  - `sourceRuleId: string`
  - `title: string`
  - `url: string`
  - `savedAt: ISOString`
  - `status: "unread" | "done" | "snoozed"`
  - `note?: string`
  - `duplicateOf?: string` — 代表ID
  - `tags: string[]`
  - `lastUpdatedAt: ISOString`
  - `socialSignalId?: string`
  - `reminderId?: string`
- **Validation**
  - URL は https:// 必須
  - `status` が `snoozed` の場合 `reminderId` 必須
- **State transitions**
  - `unread` → `done` (手動処理)
  - `unread` → `snoozed` (リマインド設定)
  - `snoozed` → `unread`/`done`（通知後の操作）

## ReviewReminder
- **Fields**
  - `id: string`
  - `bookmarkId: string`
  - `scheduledFor: ISOString`
  - `repeatCount: number` (0-5)
  - `status: "scheduled" | "sent" | "completed" | "exhausted"`
  - `channel: "digest"` (将来拡張)
- **Rules**
  - `repeatCount` >= `5` で `status` を `exhausted` にセット
  - `scheduledFor` < `now` の場合、即時ダイジェストに含める

## SocialSignal
- **Fields**
  - `id: string`
  - `bookmarkId: string`
  - `likeCount?: number`
  - `bookmarkCount?: number`
  - `commentCount?: number`
  - `fetchedFrom: "qiita" | "note" | "hatena" | "x" | "other"`
  - `fetchedAt: ISOString`
  - `ttlHours: number` (デフォルト 24)
- **Rules**
  - `ttlHours` 超過時に再取得キューへ

## DigestSnapshot
- **Fields**
  - `id: string`
  - `generatedAt: ISOString`
  - `unreadCount: number`
  - `priorityItems: { bookmarkId: string; score: number }[]`
  - `newSinceYesterday: number`
  - `remindersDue: number`
  - `copiedPayload?: string`
- **Usage**
  - ダイジェスト表示と履歴比較、クリップボードコピー用に保持（最新3件）

## AuthProfile
- **Fields**
  - `userId: string` (Google sub)
  - `email: string`
  - `displayName: string`
  - `avatarUrl?: string`
  - `tokens: { accessToken: string; refreshToken?: string; expiresAt: number }` (暗号化格納)
  - `settings: { digestTime: string; locale: string; theme: "light"|"dark"; shareDefaults: boolean }`
- **Rules**
  - ログアウト時はトークン破棄し、ローカルデータ保持方針をユーザー設定に従って決定（完全削除 or ローカル継続）

## ExportJob
- **Fields**
  - `id: string`
  - `status: "pending" | "running" | "succeeded" | "failed"`
  - `sheetUrl?: string`
  - `requestedAt: ISOString`
  - `completedAt?: ISOString`
  - `rowCount: number`
  - `errorMessage?: string`
- **Rules**
  - Google Sheets API quota 100秒/回を想定し、失敗時は5分後に再試行案内

