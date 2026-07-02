import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";

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
        We&apos;ll email you a magic link — no password to remember.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
