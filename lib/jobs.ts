import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { tables } from "@/lib/db";
import type { JobStatus } from "@/lib/types";

// Thin helper around the `jobs` table so long-running work (transcription, AI
// generation) is tracked consistently. Today the work runs inline in Route
// Handlers; this abstraction lets it move to a Queue later without changing
// callers.

export async function createJob(
  db: Db,
  params: {
    userId: string | null;
    kind: string;
    refTable?: string;
    refId?: string;
  },
): Promise<string | null> {
  try {
    const [row] = await db
      .insert(tables.jobs)
      .values({
        user_id: params.userId,
        kind: params.kind,
        ref_table: params.refTable ?? null,
        ref_id: params.refId ?? null,
        status: "queued" as JobStatus,
      })
      .returning({ id: tables.jobs.id });
    return row?.id ?? null;
  } catch {
    return null;
  }
}

export async function updateJob(
  db: Db,
  jobId: string | null,
  patch: {
    status?: JobStatus;
    error?: string | null;
    result?: Record<string, unknown> | null;
  },
): Promise<void> {
  if (!jobId) return;
  await db
    .update(tables.jobs)
    .set({ ...patch, updated_at: new Date().toISOString() })
    .where(eq(tables.jobs.id, jobId));
}
