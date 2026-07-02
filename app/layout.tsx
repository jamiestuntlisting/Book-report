import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stuntman Stories",
  description:
    "Record the stories from your stunt career and turn them into a book — written in your own voice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
