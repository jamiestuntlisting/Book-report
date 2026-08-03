import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { getBindings } from "@/lib/cf";
import { serverEnv, publicEnv } from "@/lib/env";
import { renderUrlToPdf } from "@/lib/pdf/render";
import { signedReadUrl, mediaKey, BUCKETS } from "@/lib/media";

export const maxDuration = 300;

// Builds a print-ready PDF of the user's book: renders the private /book/print
// page with a short-lived token, uploads the PDF to R2, and returns a signed
// download URL.
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const printUrl = `${publicEnv.appUrl}/book/print/${user.id}?token=${encodeURIComponent(serverEnv.pdfRenderToken)}`;

  try {
    const pdf = await renderUrlToPdf(printUrl);
    const path = `${user.id}/book-${Date.now()}.pdf`;
    await getBindings().MEDIA.put(mediaKey(BUCKETS.exports, path), pdf, {
      httpMetadata: { contentType: "application/pdf" },
    });

    const url = await signedReadUrl(BUCKETS.exports, path, 60 * 60);
    return NextResponse.json({ url, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
