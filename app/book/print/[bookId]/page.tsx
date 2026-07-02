import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { assembleBook } from "@/lib/book";
import { serverEnv } from "@/lib/env";
import { BookView } from "@/components/book/book-view";
import "./print.css";

export const dynamic = "force-dynamic";

// The page Puppeteer loads to render the print-ready PDF. `bookId` is the
// user's id; access is gated by a short-lived render token so it isn't public.
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { bookId } = await params;
  const { token } = await searchParams;

  if (!token || token !== serverEnv.pdfRenderToken) notFound();

  const admin = createAdminClient();
  const book = await assembleBook(admin, bookId);

  return <BookView book={book} forPrint />;
}
