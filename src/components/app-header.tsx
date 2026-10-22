"use client";

import Link from "next/link";
import { useState } from "react";

import { getServices } from "@/services";

// Global chrome shown on every page. Its one job beyond branding/nav is the
// "Reset demo data" action — it goes through `getServices().system`, same
// as every other UI interaction, never touching the store directly.
export function AppHeader() {
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (resetting) return;
    const confirmed = window.confirm(
      "Reset demo data? This clears every change you made in this browser and restores the original seed data.",
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      await getServices().system.resetDemoData();
      window.location.reload();
    } catch {
      setResetting(false);
    }
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
        <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-accent">
          Avora
        </Link>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resetting ? "Resetting…" : "Reset demo data"}
        </button>
      </div>
    </header>
  );
}
