import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { NavBar } from "@/components/nav-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <NavBar email={user.email ?? ""} />
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
