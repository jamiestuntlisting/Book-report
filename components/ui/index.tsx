import * as React from "react";
import { cn } from "@/lib/utils";

export { Button } from "./button";
export { Card, CardBody } from "./card";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-ink-soft", className)}
      {...props}
    />
  );
}

const badgeTones: Record<string, string> = {
  gray: "bg-black/[0.06] text-ink-soft",
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  red: "bg-red-100 text-red-800",
};

export function Badge({
  tone = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}
