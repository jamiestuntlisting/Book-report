import { NextResponse } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";
import { serverEnv, publicEnv } from "@/lib/env";
import { renderUrlToPdf } from "@/lib/pdf/render";
import { signedReadUrl, BUCKETS } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

// Builds a print-ready PDF of the user's book: renders the private /book/print
// page with a short-lived token, uploads the PDF to the exports bucket, and
// returns a signed download URL.
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const printUrl = `${publicEnv.appUrl}/book/print/${user.id}?token=${encodeURIComponent(serverEnv.pdfRenderToken)}`;

  try {
    const pdf = await renderUrlToPdf(printUrl);
    const path = `${user.id}/book-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from(BUCKETS.exports)
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(upErr.message);

    const url = await signedReadUrl(supabase, BUCKETS.exports, path, 60 * 60);
    return NextResponse.json({ url, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
