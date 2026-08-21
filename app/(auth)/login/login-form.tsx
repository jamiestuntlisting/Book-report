"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

// Pre-filled default while the app is in testing; clearable as normal.
const DEFAULT_EMAIL = "jamie@stuntlisting.com";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const res = await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next }),
    });
    if (res.ok) {
      setStatus("sent");
    } else {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setStatus("error");
      setMessage(body?.error ?? "Something went wrong — try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-8 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
        Check <strong>{email}</strong> for your sign-in link.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {status === "error" && (
        <p className="text-sm text-red-600">{message}</p>
      )}
      <Button type="submit" size="lg" disabled={status === "sending"} className="w-full">
        {status === "sending" ? "Sending…" : "Send magic link"}
      </Button>
    </form>
  );
}
