import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { requestInterview } from "./actions";
import { Badge, Button } from "@/components/ui";
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
  const hasOpenRequest = appointments.some((a) => a.status === "requested");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-ink">Interviews</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Don&apos;t want to record alone? Request an interview and we&apos;ll
          set up a Zoom call with you. The recording becomes source material
          for your chapters.
        </p>
      </div>

      <form
        action={requestInterview}
        className="rounded-xl border border-black/10 bg-white p-6 text-center"
      >
        <Button type="submit" size="lg" disabled={hasOpenRequest}>
          Request a Zoom interview
        </Button>
        <p className="mt-3 text-sm text-ink-soft">
          {hasOpenRequest
            ? "Request received — we'll reach out to schedule your Zoom call."
            : "One tap. We'll contact you to find a time."}
        </p>
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
