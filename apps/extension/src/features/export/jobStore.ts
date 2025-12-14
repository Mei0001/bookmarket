import type { ExportJob } from "@bookmarket/shared-kernel";

type JobRecord = {
  job: ExportJob;
};

const store = new Map<string, JobRecord>();

export function putJob(job: ExportJob) {
  store.set(job.id, { job });
}

export function getJob(id: string) {
  return store.get(id)?.job ?? null;
}

export function updateJob(id: string, patch: Partial<ExportJob>) {
  const current = store.get(id)?.job;
  if (!current) return null;
  const next: ExportJob = { ...current, ...patch };
  store.set(id, { job: next });
  return next;
}
