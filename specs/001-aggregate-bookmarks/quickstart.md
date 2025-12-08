# Quickstart: ブックマーク集約拡張

## 1. 前提
- Node.js 18.18+ / pnpm 9.x
- Chrome 121+ (MV3)
- Google Cloud Console で OAuth クライアント（Chrome アプリ + Web）の Client ID を取得

## 2. セットアップ
```bash
pnpm install
cp .env.example .env.local
# 必須環境変数
echo "NEXTAUTH_URL=https://extension.localhost" >> .env.local
echo "GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com" >> .env.local
echo "GOOGLE_CLIENT_SECRET=yyy" >> .env.local
echo "SHEETS_SERVICE_ACCOUNT_KEY='{}'" >> .env.local
```

## 3. 開発サーバ & 拡張プレビュー
```bash
pnpm --filter apps/extension dev        # Next.js dev server
pnpm --filter apps/extension build      # production build
pnpm --filter apps/extension export     # out/ を生成
pnpm tooling:pack-extension             # out/ + manifest から dist.zip
```
1. Chrome の `chrome://extensions` を開き、デベロッパーモードを有効化。
2. 「パッケージ化されていない拡張機能を読み込む」で `apps/extension/dist` を指定。

## 4. Google サインイン
1. Google Cloud Console で `chrome-extension://<EXT_ID>/auth/callback` と `https://extension.localhost/api/auth/callback/google` をリダイレクトURIに登録。
2. `.env.local` のクライアントID/SECRETを更新。
3. 拡張ポップアップから「Googleでログイン」を実行。

## 5. ブックマーク同期
1. `app/lib/bookmarks/sync.ts` の `startBookmarkSync()` を service worker から呼び出す。
2. ローカル環境では `pnpm bookmarks:mock-import` でモックJSONを流し込める。

## 6. ダイジェスト & リマインダー
```bash
pnpm test:unit          # Vitest + Testing Library
pnpm test:e2e           # Playwright（digest生成パス + リマインド状態遷移）
pnpm test:lint          # ESLint + Tailwind lint
```

## 7. Google Sheets エクスポート
1. Service Account を作成し、共有したい Spreadsheet へ編集権限を付与。
2. `SHEETS_SERVICE_ACCOUNT_KEY` にJSON文字列を設定。
3. 拡張のエクスポートボタンから `/api/export/google-sheets` を呼び出し、ステータスをモニタリング。

