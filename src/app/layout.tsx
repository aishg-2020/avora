import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

// Fonts come from the system stack defined in globals.css. The previous
// next/font/google setup downloaded Geist at build time, which made
// `next build` depend on network access to fonts.googleapis.com.

export const metadata: Metadata = {
  title: "Avora",
  description: "Event management over WhatsApp: weddings first.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8">{children}</main>
      </body>
    </html>
  );
}
