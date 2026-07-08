import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "./app-shell";

// No font CDN / next/font network fetch: the app must stay offline-capable.
// Inter is picked up from the system font stack defined in globals.css.

// Browser chrome matches the cockpit sidebar (--color-primary).
export const viewport: Viewport = {
  themeColor: "#0b1220",
};

export const metadata: Metadata = {
  title: {
    default: "AI Growth Operator — Demo",
    template: "%s — AI Growth Operator",
  },
  description:
    "Find money, draft the action, approve, activate, measure, learn. Demo workspace with simulated data (MVP v0 alpha).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
