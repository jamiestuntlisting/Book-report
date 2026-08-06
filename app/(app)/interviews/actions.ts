"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { createInterviewMeeting } from "@/lib/interview";

export async function requestInterview(formData: FormData) {
  const user = await requireUser();

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
      topic: "Stunt Biographies interview",
      startTime: scheduledAt,
      timezone,
    });
    providerMeetingId = meeting.providerMeetingId;
    joinUrl = meeting.joinUrl;
    status = "scheduled";
  }

  await getDb().insert(tables.interview_appointments).values({
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
  const user = await requireUser();
  await getDb()
    .update(tables.interview_appointments)
    .set({ status: "canceled" })
    .where(
      and(
        eq(tables.interview_appointments.id, id),
        eq(tables.interview_appointments.user_id, user.id),
      ),
    );
  revalidatePath("/interviews");
}
