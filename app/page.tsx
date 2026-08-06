import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { isAppConfigured } from "@/lib/env";
import { Button } from "@/components/ui";

// Reads the session cookie, so it must always render per-request.
export const dynamic = "force-dynamic";

const QUESTIONS = [
  "How did you get into stunts?",
  "The biggest stunt you've ever done?",
  "A mentor who shaped you?",
  "A day on set you'll never forget?",
];

export default async function HomePage() {
  const configured = isAppConfigured();
  const user = configured ? await getUser() : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">
        Stunt Biographies
      </p>
      <h1 className="font-serif text-5xl font-bold leading-tight text-ink">
        You&apos;ve had an incredible career.
        <br />
        You&apos;ve got a lot of stories to tell.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-ink-soft">
        We&apos;ll help you write your book. You tell the stories — we put it
        together. You get final cut. We handle all the nonsense.
      </p>

      <div className="mt-8 flex gap-3">
        {user ? (
          <Link href="/dashboard">
            <Button size="lg">Keep writing your book</Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button size="lg">Start writing your book</Button>
          </Link>
        )}
      </div>

      {!configured && (
        <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Setup needed:</strong> the app&apos;s secrets aren&apos;t
          configured yet. Set <code>AUTH_SECRET</code> and friends (see{" "}
          <code>.dev.vars.example</code> and the <code>README.md</code>), then
          reload.
        </div>
      )}

      <div className="mt-16">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Prompts to get you started
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {QUESTIONS.map((q) => (
            <li
              key={q}
              className="rounded-lg border border-black/10 bg-white p-4 font-serif text-lg text-ink"
            >
              {q}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
