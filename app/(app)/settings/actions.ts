"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

export async function saveProfile(formData: FormData) {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      display_name: (formData.get("display_name") as string) || null,
      bio: (formData.get("bio") as string) || null,
    })
    .eq("id", user.id);
  revalidatePath("/settings");
}

export async function saveReminderPrefs(formData: FormData) {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();

  const channel = formData.get("reminder_channel") === "email" ? "email" : "sms";
  await supabase
    .from("profiles")
    .update({
      phone: (formData.get("phone") as string)?.trim() || null,
      reminder_opt_in: formData.get("reminder_opt_in") === "on",
      reminder_channel: channel,
    })
    .eq("id", user.id);
  revalidatePath("/settings");
}
