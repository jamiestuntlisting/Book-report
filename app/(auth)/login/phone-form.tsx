"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui";

// Phone sign-in via Supabase phone auth: a one-time code is texted through the
// Twilio credentials configured in the Supabase dashboard. Requires the Phone
// provider to be enabled (see README).
export function PhoneForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"enter-phone" | "enter-code">("enter-phone");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function normalizePhone(input: string): string {
    const digits = input.replace(/[^\d+]/g, "");
    // Default to US country code when none is given.
    if (digits.startsWith("+")) return digits;
    if (digits.length === 10) return `+1${digits}`;
    return `+${digits}`;
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizePhone(phone),
    });
    setBusy(false);
    if (error) {
      setMessage(
        error.message.includes("not enabled") || error.message.includes("provider")
          ? "Text sign-in isn't set up yet — use email for now."
          : error.message,
      );
    } else {
      setStage("enter-code");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizePhone(phone),
      token: code.trim(),
      type: "sms",
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
    } else {
      router.push(next);
      router.refresh();
    }
  }

  if (stage === "enter-code") {
    return (
      <form onSubmit={verifyCode} className="mt-8 space-y-4">
        <p className="text-sm text-ink-soft">
          We texted a code to <strong>{normalizePhone(phone)}</strong>.
        </p>
        <div>
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        {message && <p className="text-sm text-red-600">{message}</p>}
        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {busy ? "Checking…" : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => setStage("enter-phone")}
          className="w-full text-sm text-ink-soft hover:underline"
        >
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+1 555 555 5555"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? "Sending…" : "Text me a code"}
      </Button>
    </form>
  );
}
