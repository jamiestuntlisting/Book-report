import { NextResponse, type NextRequest } from "next/server";
import type {
  R2ObjectBody,
  ReadableStream as CfReadableStream,
} from "@cloudflare/workers-types";
import { getBindings } from "@/lib/cf";
import { getUser } from "@/lib/auth/session";
import { keyOwner, verifyMediaSig } from "@/lib/media";
import { serverEnv } from "@/lib/env";

// Streams R2 objects in and out. See lib/media.ts for the access model.

async function canRead(request: NextRequest, key: string): Promise<boolean> {
  const { searchParams } = new URL(request.url);
  if (await verifyMediaSig(key, searchParams.get("exp"), searchParams.get("sig"))) {
    return true;
  }
  const bearer = request.headers.get("authorization");
  if (bearer === `Bearer ${serverEnv.pdfRenderToken}`) return true;
  const user = await getUser();
  return Boolean(user && keyOwner(key) === user.id);
}

function keyFromParams(segments: string[]): string {
  return segments.map(decodeURIComponent).join("/");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const key = keyFromParams((await params).key);
  if (!(await canRead(request, key))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { MEDIA } = getBindings();
  const rangeHeader = request.headers.get("range");

  let object: R2ObjectBody | null;
  if (rangeHeader) {
    // Parse a single "bytes=start-end" range (all browsers send this form).
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      return new NextResponse("Bad range", { status: 416 });
    }
    const head = await MEDIA.head(key);
    if (!head) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const size = head.size;
    let start: number;
    let end: number;
    if (m[1] === "") {
      // suffix range: last N bytes
      const suffix = Math.min(Number(m[2]), size);
      start = size - suffix;
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) {
      return new NextResponse("Bad range", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    object = await MEDIA.get(key, {
      range: { offset: start, length: end - start + 1 },
    });
    if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(object.body as unknown as BodyInit, {
      status: 206,
      headers: {
        "Content-Type":
          object.httpMetadata?.contentType ?? "application/octet-stream",
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=0",
      },
    });
  }

  object = await MEDIA.get(key);
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(object.body as unknown as BodyInit, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(object.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=0",
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const key = keyFromParams((await params).key);
  const user = await getUser();
  if (!user || keyOwner(key) !== user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { MEDIA } = getBindings();
  const contentType =
    request.headers.get("content-type") ?? "application/octet-stream";
  await MEDIA.put(key, request.body as unknown as CfReadableStream, {
    httpMetadata: { contentType },
  });
  return NextResponse.json({ ok: true, key });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const key = keyFromParams((await params).key);
  const user = await getUser();
  if (!user || keyOwner(key) !== user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  await getBindings().MEDIA.delete(key);
  return NextResponse.json({ ok: true });
}
