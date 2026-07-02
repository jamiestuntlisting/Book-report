"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { Button, Input, Label } from "@/components/ui";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${publicEnv.appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
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
