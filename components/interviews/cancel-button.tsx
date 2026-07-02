"use client";

import { useTransition } from "react";
import { cancelInterview } from "@/app/(app)/interviews/actions";

export function CancelInterviewButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => cancelInterview(id))}
      disabled={pending}
      className="text-sm text-ink-soft hover:text-red-600"
    >
      {pending ? "Canceling…" : "Cancel"}
    </button>
  );
}
