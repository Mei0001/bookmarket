# Research: ブックマーク集約拡張

## R-001 Next.js App Router を MV3 拡張へ同梱する方法
- **Decision**: Next.js 14(App Router) を `next export` で静的出力し、`apps/extension/out` を Chrome MV3 拡張の `dist` として manifest に組み込む。Popup/Options/Standalone ダッシュボードはそれぞれ Next のルートを割り当て、service worker は Vite/tsup で個別ビルドする。
- **Rationale**: App Router の React Server Components は `next export` で自動的に Client Components のみ出力され、ホスティング不要で拡張に同梱できる。静的ファイル化により Chrome の CSP 制約を満たしやすく、Next の開発体験を残しつつ MV3 の `action.default_popup` にHTMLを指定できる。
- **Alternatives considered**:
  - **Next.js をサーバとしてホストし iframe で読み込む**: オフライン要件とローカルデータ保持に反するため却下。
  - **純粋な Vite/React で再実装**: ユーザー指定スタックに反し、App Router のレイアウトやAPI Routeを活かせないため却下。

## R-002 Google OAuth for Extension Settings Sync
- **Decision**: NextAuth.js の Google プロバイダを App Router Route Handler (`app/api/auth/[...nextauth]/route.ts`) に配置し、拡張のオプションページを `chrome.identity.launchWebAuthFlow` 経由で起動して OAuth 同意を完了させ、取得した ID トークンを LocalStorage + IndexedDB に暗号化保存する。
- **Rationale**: NextAuth はトークン更新ロジックとセッション管理を提供し、App Router/Route Handler で Edge Runtime にも対応する。`launchWebAuthFlow` を利用すると拡張IDを redirect URI に含めて Google Cloud Console に登録でき、ポップアップ内でもサインインが成立する。
- **Alternatives considered**:
  - **Chrome Identity API の非Next実装**: Next.js とのスタック整合性が下がるうえ、将来のWeb版共有が難しい。
  - **独自OAuth実装**: リフレッシュトークン管理やPKCE対応を自前で行うコストが高い。

## R-003 Social Signal Aggregation Strategy
- **Decision**: 対象サイトごとに公式/公開APIを優先利用し、無い場合は `opengraph`/`oEmbed`/`JSON-LD` を1日キャッシュするフェデレーションアダプタを `features/social-signals` として実装。初期対応は Qiita API、Note GraphQL、Hatena Bookmark JSON API、X(Twitter) は `https://cdn.syndication.twimg.com/widgets/tweet` エンドポイントでいいね数を取得。取得不能時はメトリクスを `null` としダイジェストに「データなし」表示。
- **Rationale**: 各サービスの公開APIはレート制限があるが、ユーザー登録ドメイン数を10件に制限すれば1時間同期でも制限内に収まる。キャッシュ層を挟むことで同一URLの重複アクセスを抑制できる。
- **Alternatives considered**:
  - **スクレイピング**: 利用規約リスクが高く、拡張からのクロスオリジン制限もあるため不可。
  - **外部サーバに集約プロキシを構築**: 「端末内完結」の前提と矛盾する。

## R-004 LocalStorage/IndexedDB Persistence Best Practices
- **Decision**: 低レイテンシ用途（UIフィルタ状態、未確認フラグ）は LocalStorage、同期済みブックマークやリマインダーキューは `idb` ライブラリ経由で IndexedDB に保存し、非同期処理中に `navigator.storage.persist()` を要求してデータ喪失を防ぐ。Chrome bookmarks API のスナップショット hash を保持し、差分適用後に LocalStorage の `lastSyncAt` を更新。
- **Rationale**: LocalStorage は同期イベントを扱いやすいが容量制限(約5MB)があるため、1,000件のブックマーク＋メタ情報は IndexedDB に委譲する必要がある。`idb` は TypeScript フレンドリでトランザクション制御が容易。
- **Alternatives considered**:
  - **すべて LocalStorage**: 大量データで溢れやすく、非同期書き込みがブロッキングになる。
  - **Chrome storage.sync**: 容量が100KB程度で要件を満たせない。

## R-005 Tailwind CSS in Extension UI
- **Decision**: Tailwind を `apps/extension/tailwind.config.ts` で `content` に `app/**/*.{ts,tsx}` および `components/**/*` を指定し、`@tailwind base/components/utilities` をポップアップ/オプションのグローバルCSSに限定的に適用。`tailwindcss/nesting` + `postcss-preset-env` でMV3のCSP制約下でも動作させ、`@tailwindcss/typography` をダイジェスト要約に利用する。
- **Rationale**: Tailwind は小さなポップアップUIでもユーティリティクラスでスタイルが完結し、`next build` + `next export` で生成される CSS が tree-shake されるため拡張バンドルサイズを抑えられる。
- **Alternatives considered**:
  - **CSS-in-JS (styled-components)**: MV3 の `unsafe-eval` 禁止で実装が複雑。
  - **素のCSS**: 一貫したデザインシステム整備に追加コスト。

