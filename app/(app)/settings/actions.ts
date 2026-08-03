"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";

export async function saveProfile(formData: FormData) {
  const user = await requireUser();
  await getDb()
    .update(tables.profiles)
    .set({
      display_name: (formData.get("display_name") as string) || null,
      bio: (formData.get("bio") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .where(eq(tables.profiles.id, user.id));
  revalidatePath("/settings");
}

export async function saveReminderPrefs(formData: FormData) {
  const user = await requireUser();

  const channel = formData.get("reminder_channel") === "email" ? "email" : "sms";
  await getDb()
    .update(tables.profiles)
    .set({
      phone: (formData.get("phone") as string)?.trim() || null,
      reminder_opt_in: formData.get("reminder_opt_in") === "on",
      reminder_channel: channel,
      updated_at: new Date().toISOString(),
    })
    .where(eq(tables.profiles.id, user.id));
  revalidatePath("/settings");
}
