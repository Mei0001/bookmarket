export default function Home() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Bookmarket Sync Service</h1>
      <p style={{ marginTop: 8, color: "#555" }}>
        拡張機能（US2）の Google ログインと、SourceRule/Bookmark の同期・復元に使う最小バックエンドです。
      </p>
      <ul style={{ marginTop: 12, lineHeight: 1.8 }}>
        <li>
          Auth: <code>/api/auth/*</code>（NextAuth）
        </li>
        <li>
          Extension OAuth bridge: <code>/ext/start</code> → <code>/ext/complete</code>
        </li>
        <li>
          Sync API: <code>/api/ext/state</code>
        </li>
      </ul>
    </main>
  );
}

