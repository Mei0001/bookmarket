import type { BookmarkItem, SourceRule } from "@bookmarket/shared-kernel";

function formatDate(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function BookmarkList(props: { items: BookmarkItem[]; sourceRules: SourceRule[] }) {
  const ruleById = new Map(props.sourceRules.map((r) => [r.id, r]));

  return (
    <div className="space-y-3">
      {props.items.map((item) => {
        const rule = ruleById.get(item.sourceRuleId);
        return (
          <article key={item.id} className="card-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-base font-semibold hover:underline"
                  title={item.title}
                >
                  {item.title}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="truncate">{hostname(item.url)}</span>
                  <span aria-hidden>•</span>
                  <span>{formatDate(item.savedAt)}</span>
                </div>
              </div>

              {rule ? (
                <span
                  className="shrink-0 rounded-full px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: `${rule.colorHex}22`,
                    border: `1px solid ${rule.colorHex}55`,
                    color: rule.colorHex,
                  }}
                  title={rule.pattern}
                >
                  {rule.label}
                </span>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

