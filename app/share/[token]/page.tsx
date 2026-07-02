import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { assembleBook } from "@/lib/book";
import { BookView } from "@/components/book/book-view";
import type { Share } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public, read-only book view. Runs server-side with the service-role client,
// validating the token — no permissive anonymous RLS policy is needed.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: shareRaw } = await admin
    .from("shares")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  const share = shareRaw as Share | null;

  if (!share || share.revoked) notFound();
  if (share.expires_at && new Date(share.expires_at) < new Date()) notFound();

  // Best-effort view count; ignore failures.
  await admin
    .from("shares")
    .update({ view_count: share.view_count + 1 })
    .eq("id", share.id);

  const book = await assembleBook(admin, share.user_id);

  return (
    <main className="min-h-screen bg-parchment py-10">
      <BookView book={book} />
      <p className="mx-auto mt-8 max-w-2xl px-10 text-center text-xs text-ink-soft">
        Made with Stuntman Stories
      </p>
    </main>
  );
}
