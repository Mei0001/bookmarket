import type { ReactNode } from "react";

export function EmptyState(props: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="card-surface p-6">
      <h2 className="text-lg font-semibold">{props.title}</h2>
      {props.description ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{props.description}</p> : null}
      {props.actions ? <div className="mt-4 flex flex-wrap gap-2">{props.actions}</div> : null}
    </div>
  );
}

