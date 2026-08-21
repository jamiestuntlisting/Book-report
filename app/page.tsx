import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { isAppConfigured } from "@/lib/env";
import { Button } from "@/components/ui";

// Reads the session cookie, so it must always render per-request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const configured = isAppConfigured();
  const user = configured ? await getUser() : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-serif text-6xl font-bold leading-none text-ink sm:text-7xl">
        Stunt
        <br />
        Biographies
      </h1>
      <p className="mt-8 max-w-xl text-balance font-serif text-2xl leading-snug text-ink">
        You&apos;ve had an incredible career. You&apos;ve got a lot of stories
        to tell.
      </p>
      <p className="mt-4 max-w-xl text-balance text-lg text-ink-soft">
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
    </main>
  );
}
