import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobStatus } from "@/lib/types";

// Thin helper around the `jobs` table so long-running work (transcription, AI
// generation) is tracked consistently. Today the work runs inline in Route
// Handlers; this abstraction lets it move to a queue/Edge Function later
// without changing callers.

export async function createJob(
  admin: SupabaseClient,
  params: {
    userId: string | null;
    kind: string;
    refTable?: string;
    refId?: string;
  },
): Promise<string | null> {
  const { data, error } = await admin
    .from("jobs")
    .insert({
      user_id: params.userId,
      kind: params.kind,
      ref_table: params.refTable ?? null,
      ref_id: params.refId ?? null,
      status: "queued" as JobStatus,
    })
    .select("id")
    .single();
  if (error) return null;
  return data.id;
}

export async function updateJob(
  admin: SupabaseClient,
  jobId: string | null,
  patch: {
    status?: JobStatus;
    error?: string | null;
    result?: Record<string, unknown> | null;
  },
): Promise<void> {
  if (!jobId) return;
  await admin
    .from("jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}
