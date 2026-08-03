import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { isZoomConfigured } from "@/lib/interview";
import { requestInterview } from "./actions";
import { Badge, Button, Input, Label, Textarea } from "@/components/ui";
import { CancelInterviewButton } from "@/components/interviews/cancel-button";
import { formatDate } from "@/lib/utils";
import type { InterviewAppointment, InterviewStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusTone: Record<InterviewStatus, "gray" | "blue" | "green" | "red"> = {
  requested: "gray",
  scheduled: "blue",
  completed: "green",
  canceled: "red",
};

export default async function InterviewsPage() {
  const user = await requireUser();
  const rows = await getDb()
    .select()
    .from(tables.interview_appointments)
    .where(eq(tables.interview_appointments.user_id, user.id))
    .orderBy(desc(tables.interview_appointments.created_at));
  const appointments = rows as InterviewAppointment[];
  const zoomReady = isZoomConfigured();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-ink">Interviews</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Don&apos;t want to record alone? Book a time to be interviewed. The call
          is recorded and the recording becomes source material for your chapters.
        </p>
      </div>

      {!zoomReady && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Zoom isn&apos;t connected yet, so meetings won&apos;t be auto-created.
          You can still request a time — an organizer will follow up with a link.
          Once <code>ZOOM_*</code> env vars are set, meetings and recording
          ingestion happen automatically.
        </div>
      )}

      <form action={requestInterview} className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="mb-4 font-serif text-lg text-ink">Request an interview</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="scheduled_at">Preferred date & time</Label>
            <Input id="scheduled_at" name="scheduled_at" type="datetime-local" />
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" name="timezone" placeholder="e.g. America/Los_Angeles" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">What do you want to talk about?</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Stories, topics, anything the interviewer should know…" />
          </div>
        </div>
        <div className="mt-4">
          <Button type="submit">Request interview</Button>
        </div>
      </form>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Your interviews
        </h2>
        {appointments.length === 0 ? (
          <p className="text-ink-soft">No interviews requested yet.</p>
        ) : (
          <ul className="space-y-3">
            {appointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-black/10 bg-white p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[a.status]}>{a.status}</Badge>
                    <span className="font-medium text-ink">
                      {a.scheduled_at ? formatDate(a.scheduled_at) : "Time TBD"}
                    </span>
                  </div>
                  {a.notes && <p className="mt-1 text-sm text-ink-soft">{a.notes}</p>}
                  {a.join_url && (
                    <a href={a.join_url} target="_blank" className="mt-1 inline-block text-sm text-accent hover:underline">
                      Join link
                    </a>
                  )}
                </div>
                {a.status !== "canceled" && a.status !== "completed" && (
                  <CancelInterviewButton id={a.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
