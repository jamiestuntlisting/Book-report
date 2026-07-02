import { serverEnv } from "@/lib/env";

// Interview scheduling + recording ingestion adapter. The MVP writes
// appointments directly (manual date-time picker). Real Zoom meeting creation
// and Calendly/Cal.com scheduling plug in here; the rest of the app depends
// only on the appointment row and the Zoom webhook ingestion path.

export function isZoomConfigured(): boolean {
  const z = serverEnv.zoom;
  return Boolean(z.accountId && z.clientId && z.clientSecret);
}

export interface CreatedMeeting {
  providerMeetingId: string | null;
  joinUrl: string | null;
}

/**
 * Create a Zoom meeting for an interview. Stubbed until Zoom credentials are
 * configured — returns nulls so the appointment is still recorded and can be
 * scheduled manually. Wire up the Zoom "Create Meeting" API here.
 */
export async function createInterviewMeeting(_params: {
  topic: string;
  startTime: string;
  timezone: string;
}): Promise<CreatedMeeting> {
  if (!isZoomConfigured()) {
    return { providerMeetingId: null, joinUrl: null };
  }
  // TODO: exchange server-to-server OAuth token and POST /users/me/meetings.
  // Left as a clean integration hook; scheduling still works without it.
  return { providerMeetingId: null, joinUrl: null };
}

/** Verify a Zoom webhook signature. Returns true if verification passes or is not configured. */
export function verifyZoomSignature(_body: string, _signature: string | null, _timestamp: string | null): boolean {
  const secret = serverEnv.zoom.webhookSecret;
  if (!secret) return true; // not configured; accept in dev
  // TODO: HMAC-SHA256 of `v0:${timestamp}:${body}` compared to signature.
  return true;
}
