"use client";

import { useState } from "react";
import { Mail, MessageSquareText } from "lucide-react";
import { LoginForm } from "./login-form";
import { PhoneForm } from "./phone-form";
import { cn } from "@/lib/utils";

export function LoginTabs() {
  const [tab, setTab] = useState<"phone" | "email">("phone");

  return (
    <div className="mt-6">
      <div className="flex gap-1 rounded-lg bg-black/[0.05] p-1">
        <TabButton
          active={tab === "phone"}
          onClick={() => setTab("phone")}
          icon={<MessageSquareText size={15} />}
          label="Text me"
        />
        <TabButton
          active={tab === "email"}
          onClick={() => setTab("email")}
          icon={<Mail size={15} />}
          label="Email me"
        />
      </div>
      {tab === "phone" ? <PhoneForm /> : <LoginForm />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink",
      )}
    >
      {icon} {label}
    </button>
  );
}
