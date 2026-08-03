"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Stories" },
  { href: "/book", label: "Book" },
  { href: "/interviews", label: "Interviews" },
  { href: "/settings", label: "Settings" },
];

export function NavBar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-serif text-lg font-bold text-ink">
            Stuntman Stories
          </Link>
          <nav className="flex gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname.startsWith(l.href)
                    ? "bg-accent/10 text-accent"
                    : "text-ink-soft hover:bg-black/[0.04]",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <span className="hidden sm:inline">{email}</span>
          <button onClick={signOut} className="hover:text-accent hover:underline">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
