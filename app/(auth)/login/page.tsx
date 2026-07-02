import { Suspense } from "react";
import Link from "next/link";
import { LoginTabs } from "./login-tabs";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-2 text-sm text-ink-soft hover:underline">
        ← Stuntman Stories
      </Link>
      <h1 className="font-serif text-3xl font-bold text-ink">
        Sign in to your book
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Get a one-time code by text, or a magic link by email — no password to
        remember.
      </p>
      <Suspense>
        <LoginTabs />
      </Suspense>
    </main>
  );
}
