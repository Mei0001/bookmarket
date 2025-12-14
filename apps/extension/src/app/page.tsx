"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OptionsApp } from "@/features/options/OptionsApp";
import { PopupApp } from "@/features/popup/PopupApp";

const steps = [
  "SourceRule（対象ドメイン）を登録",
  "Chromeブックマークを同期して重複排除",
  "Popupで一覧表示（並び替え・空状態）"
] as const;

function HomePreview() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-widest text-gray-500">Preview</p>
        <h1 className="text-3xl font-semibold">Bookmarket Aggregator</h1>
        <p className="text-base text-gray-600">
          Chrome拡張向けUIを Next.js で開発しています。拡張では query によって Popup/Options を切り替えます。
        </p>
      </header>

      <section className="card-surface p-6 shadow-card">
        <h2 className="text-xl font-medium">ショートカット</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/?popup=1"
            className="inline-flex items-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-95"
          >
            Popup を開く
          </Link>
          <Link
            href="/?options=1"
            className="inline-flex items-center rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Options を開く
          </Link>
        </div>
      </section>

      <section className="card-surface p-6 shadow-card">
        <h2 className="text-xl font-medium">MVPフロー</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-gray-700">
          {steps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}

export default function Page() {
  const searchParams = useSearchParams();
  const isPopup = searchParams.get("popup") === "1";
  const isOptions = searchParams.get("options") === "1";

  if (isPopup) return <PopupApp />;
  if (isOptions) return <OptionsApp />;
  return <HomePreview />;
}
