"use client";

import { useEffect, useRef, useState } from "react";

import { Badge, Button } from "@/components/ui";
import type { IdDocumentSide } from "@/lib/types";

// Picks an image and shows it with a local object URL. Nothing leaves the
// browser; the preview lives in component memory and is revoked on unmount.
// The only thing a parent persists is that this side was received.
export function ImageSlot({
  side,
  received,
  onSelected,
}: {
  side: IdDocumentSide;
  received: boolean;
  onSelected: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    onSelected();
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium capitalize">{side}</span>
        {received ? <Badge tone="good">Received</Badge> : <Badge>Not yet</Badge>}
      </div>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL, not an optimisable asset
        <img src={previewUrl} alt={`${side} of ID (local preview)`} className="max-h-48 w-full rounded-md object-contain" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-md bg-surface text-center text-sm text-muted">
          {received ? "Photo received via WhatsApp (not stored in demo)" : "No photo yet"}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          {previewUrl ? "Choose another" : "Choose image"}
        </Button>
        <span className="text-xs text-muted">Preview only — not uploaded.</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
