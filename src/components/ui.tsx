"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect } from "react";

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description && <p className="text-muted">{description}</p>}
    </header>
  );
}

export function MockBanner() {
  return (
    <p className="mb-6 rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted">
      Demo data, stored only in this browser. Nothing is sent for real — use “Reset demo data” in the
      header to start over.
    </p>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing here yet.",
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  /** When set, rows become clickable (pointer cursor + hover highlight). */
  onRowClick?: (row: T) => void;
}) {
  if (rows.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="px-4 py-3 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-t border-border ${onRowClick ? "cursor-pointer transition hover:bg-surface" : ""}`}
            >
              {columns.map((c) => (
                <td key={c.header} className="px-4 py-3 align-top">
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const badgeTones: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  neutral: "bg-surface text-muted",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

const buttonVariants = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-border bg-surface hover:border-accent",
  ghost: "text-muted hover:text-foreground",
  danger: "border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-900/30",
} as const;

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl border border-border bg-background p-5 shadow-xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-muted hover:bg-surface hover:text-foreground"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// Base look for text inputs / selects / textareas. `inputClassName` fills
// its container (forms); `inlineInputClassName` sizes to content (toolbars,
// table cells). Kept as two constants because appending `w-auto` to a class
// list that already has `w-full` does not override it in Tailwind.
const inputBase = "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";
export const inputClassName = `w-full ${inputBase}`;
export const inlineInputClassName = inputBase;

