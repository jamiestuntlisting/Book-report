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
