const steps = [
  "Register the blogs / handles you want to follow",
  "Sync recent bookmarks from Chrome",
  "Tag unread items and queue reminders"
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-widest text-gray-500">Preview</p>
        <h1 className="text-3xl font-semibold">Bookmarket Aggregator</h1>
        <p className="text-base text-gray-600">
          The UI will eventually mount inside the Chrome extension popup. For now we expose a dashboard shell so the design system
          can be iterated in the browser while core data services are being built.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium">Coming Up Next</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-gray-700">
          {steps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-gray-500">
          Use <code>pnpm dev</code> to view this page and reload automatically while implementing each user story.
        </p>
      </section>
    </main>
  );
}
