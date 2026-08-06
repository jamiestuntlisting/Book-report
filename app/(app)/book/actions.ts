"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";

export async function saveBookSettings(formData: FormData) {
  const user = await requireUser();
  const db = getDb();

  const patch = {
    title: (formData.get("title") as string)?.slice(0, 200) || "My Stunt Stories",
    subtitle: (formData.get("subtitle") as string) || null,
    author_name: (formData.get("author_name") as string) || null,
    dedication: (formData.get("dedication") as string) || null,
    foreword: (formData.get("foreword") as string) || null,
    trim_size: (formData.get("trim_size") as string) || "6x9",
    updated_at: new Date().toISOString(),
  };

  const updated = await db
    .update(tables.book_settings)
    .set(patch)
    .where(eq(tables.book_settings.user_id, user.id))
    .returning({ id: tables.book_settings.id });
  if (!updated.length) {
    await db.insert(tables.book_settings).values({ user_id: user.id, ...patch });
  }

  revalidatePath("/book");
}

/** Records the uploaded cover image (path within the photos bucket). */
export async function saveCoverImage(path: string | null) {
  const user = await requireUser();
  const db = getDb();
  const patch = { cover_image_path: path, updated_at: new Date().toISOString() };
  const updated = await db
    .update(tables.book_settings)
    .set(patch)
    .where(eq(tables.book_settings.user_id, user.id))
    .returning({ id: tables.book_settings.id });
  if (!updated.length) {
    await db.insert(tables.book_settings).values({ user_id: user.id, ...patch });
  }
  revalidatePath("/book");
}
