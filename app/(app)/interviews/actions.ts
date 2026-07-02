"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createInterviewMeeting } from "@/lib/interview";

export async function requestInterview(formData: FormData) {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();

  const scheduledAt = (formData.get("scheduled_at") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const timezone =
    (formData.get("timezone") as string) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  let providerMeetingId: string | null = null;
  let joinUrl: string | null = null;
  let status: "requested" | "scheduled" = "requested";

  if (scheduledAt) {
    const meeting = await createInterviewMeeting({
      topic: "Stuntman Stories interview",
      startTime: scheduledAt,
      timezone,
    });
    providerMeetingId = meeting.providerMeetingId;
    joinUrl = meeting.joinUrl;
    status = "scheduled";
  }

  await supabase.from("interview_appointments").insert({
    user_id: user.id,
    scheduled_at: scheduledAt,
    timezone,
    status,
    provider: "zoom",
    provider_meeting_id: providerMeetingId,
    join_url: joinUrl,
    notes,
  });

  revalidatePath("/interviews");
}

export async function cancelInterview(id: string) {
  const supabase = await createClient();
  await supabase
    .from("interview_appointments")
    .update({ status: "canceled" })
    .eq("id", id);
  revalidatePath("/interviews");
}
