import AppEntry from "@/app/AppEntry";
import { Suspense } from "react";

// NOTE:
// `output: "export"` の静的ビルドでは、Server Component 側で `searchParams` を参照すると
// static generation bailout になりやすい（Next 16+）。そのためモード判定は client 側で行う。
export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-widest text-gray-500">Preview</p>
            <h1 className="text-3xl font-semibold">Bookmarket Aggregator</h1>
            <p className="text-base text-gray-600">Loading…</p>
          </header>
        </main>
      }
    >
      <AppEntry />
    </Suspense>
  );
}
