import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, tables } from "@/lib/db";
import { assembleBook } from "@/lib/book";
import { BookView } from "@/components/book/book-view";
import type { Share } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public, read-only book view. The token is the only credential; photo URLs
// inside the book are short-lived signed media URLs.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const [shareRaw] = await db
    .select()
    .from(tables.shares)
    .where(eq(tables.shares.token, token))
    .limit(1);
  const share = (shareRaw as Share | undefined) ?? null;

  if (!share || share.revoked) notFound();
  if (share.expires_at && new Date(share.expires_at) < new Date()) notFound();

  // Best-effort view count; ignore failures.
  await db
    .update(tables.shares)
    .set({ view_count: share.view_count + 1 })
    .where(eq(tables.shares.id, share.id))
    .catch(() => {});

  const book = await assembleBook(db, share.user_id);

  return (
    <main className="min-h-screen bg-parchment py-10">
      <BookView book={book} />
      <p className="mx-auto mt-8 max-w-2xl px-10 text-center text-xs text-ink-soft">
        Made with Stuntman Stories
      </p>
    </main>
  );
}
