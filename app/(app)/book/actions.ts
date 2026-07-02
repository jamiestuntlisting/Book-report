"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

export async function saveBookSettings(formData: FormData) {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();

  const patch = {
    title: (formData.get("title") as string)?.slice(0, 200) || "My Stunt Stories",
    subtitle: (formData.get("subtitle") as string) || null,
    author_name: (formData.get("author_name") as string) || null,
    dedication: (formData.get("dedication") as string) || null,
    foreword: (formData.get("foreword") as string) || null,
    trim_size: (formData.get("trim_size") as string) || "6x9",
  };

  await supabase
    .from("book_settings")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });

  revalidatePath("/book");
}
