import { z } from "zod";

export const ExportJobSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["pending", "running", "succeeded", "failed"]).default("pending"),
  sheetUrl: z.string().url().nullable().optional(),
  rowCount: z.number().int().nonnegative().optional(),
  requestedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  errorMessage: z.string().optional()
});

export type ExportJob = z.infer<typeof ExportJobSchema>;







