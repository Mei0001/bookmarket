export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-widest text-gray-500">Dashboard</p>
        <h1 className="text-3xl font-semibold">Bookmarket</h1>
        <p className="text-base text-gray-600">US4: 朝のダイジェスト生成 / 共有コピー / Google Sheets エクスポート</p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium">朝のダイジェスト</h2>
        <p className="mt-2 text-sm text-gray-600">未確認ブックマークを優先度順に要約し、共有コピーとSheetsエクスポートを提供します。</p>
        <div className="mt-4">
          <a className="inline-flex rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white" href="/digest">
            ダイジェストを開く
          </a>
        </div>
      </section>
    </main>
  );
}
