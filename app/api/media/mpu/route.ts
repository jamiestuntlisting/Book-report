import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { ReadableStream as CfReadableStream } from "@cloudflare/workers-types";
import { getBindings } from "@/lib/cf";
import { getUser } from "@/lib/auth/session";
import { keyOwner } from "@/lib/media";

// R2 multipart upload for big recordings (single-request uploads are capped by
// the Workers request-body limit). Flow: create → PUT parts → complete.

const createSchema = z.object({
  action: z.literal("create"),
  key: z.string().min(3),
  contentType: z.string().default("application/octet-stream"),
});

const completeSchema = z.object({
  action: z.literal("complete"),
  key: z.string().min(3),
  uploadId: z.string().min(1),
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1), etag: z.string() }))
    .min(1),
});

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { MEDIA } = getBindings();

  const create = createSchema.safeParse(body);
  if (create.success) {
    const { key, contentType } = create.data;
    if (keyOwner(key) !== user.id) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const upload = await MEDIA.createMultipartUpload(key, {
      httpMetadata: { contentType },
    });
    return NextResponse.json({ uploadId: upload.uploadId });
  }

  const complete = completeSchema.safeParse(body);
  if (complete.success) {
    const { key, uploadId, parts } = complete.data;
    if (keyOwner(key) !== user.id) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const upload = MEDIA.resumeMultipartUpload(key, uploadId);
    await upload.complete(
      parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
    );
    return NextResponse.json({ ok: true, key });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}

// Part upload: PUT /api/media/mpu?key=...&uploadId=...&part=N with raw bytes.
export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";
  const uploadId = searchParams.get("uploadId") ?? "";
  const part = Number(searchParams.get("part"));
  if (!key || !uploadId || !Number.isInteger(part) || part < 1 || !request.body) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (keyOwner(key) !== user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const upload = getBindings().MEDIA.resumeMultipartUpload(key, uploadId);
  const uploaded = await upload.uploadPart(
    part,
    request.body as unknown as CfReadableStream,
  );
  return NextResponse.json({ etag: uploaded.etag, partNumber: part });
}
