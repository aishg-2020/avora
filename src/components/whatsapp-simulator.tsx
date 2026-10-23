"use client";

// "Preview as guest": a fake phone screen that renders a campaign message
// the way the guest would see it in WhatsApp, with working RSVP quick
// replies. Replies go through the service layer (`guests.upsertRsvp`) like
// every other mutation — the chat thread itself is ephemeral UI state.

import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAsyncData } from "@/lib/use-async-data";
import { renderTemplate } from "@/lib/template";
import type { Guest, MessageTemplate, RsvpStatus } from "@/lib/types";
import { CURRENT_EVENT_ID, getServices } from "@/services";

interface Bubble {
  id: number;
  from: "business" | "guest";
  text: string;
}

const QUICK_REPLIES: { status: RsvpStatus; label: string }[] = [
  { status: "attending", label: "Attending ✅" },
  { status: "declined", label: "Can't make it ❌" },
  { status: "maybe", label: "Maybe 🤔" },
];

const statusPhrase: Record<RsvpStatus, string> = {
  attending: "attending",
  declined: "declined",
  maybe: "a maybe",
  pending: "pending",
};

export function WhatsAppSimulator({
  open,
  onClose,
  guest,
  template,
  functionId,
  onRsvpChanged,
}: {
  open: boolean;
  onClose: () => void;
  guest: Guest;
  template: MessageTemplate;
  /** The function this campaign targets. Omitted → quick replies RSVP to every function. */
  functionId?: string;
  /** Called after a quick reply saved, so parents can refresh RSVP views. */
  onRsvpChanged?: () => void;
}) {
  const { data } = useAsyncData(async () => {
    const { events, logistics, messaging } = getServices();
    const [event, functions, connection, room] = await Promise.all([
      events.getEvent(CURRENT_EVENT_ID),
      events.listFunctions(CURRENT_EVENT_ID),
      messaging.getConnection(),
      logistics.findRoomForGuest(guest.id),
    ]);
    return { event, functions, connection, room };
  }, [guest.id]);

  const [extraBubbles, setExtraBubbles] = useState<Bubble[]>([]);
  const [saving, setSaving] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the newest bubble in view, like a real chat.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [extraBubbles.length, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const functions = data?.functions ?? [];
  const targetFunction = functionId ? functions.find((f) => f.id === functionId) : undefined;
  const firstName = guest.name.split(" ")[0];

  const rendered = renderTemplate(template.body, {
    guestName: guest.name,
    functionName: targetFunction?.name ?? data?.event?.name ?? "the celebrations",
    eventName: data?.event?.name ?? "the celebrations",
    room: data?.room?.roomNo,
    hotel: data?.room?.hotel,
  });

  async function reply(status: RsvpStatus, label: string) {
    if (saving) return;
    setSaving(true);
    try {
      const { guests } = getServices();
      const targets = targetFunction ? [targetFunction] : functions;
      const headcount = status === "declined" ? 0 : 1;
      for (const fn of targets) {
        await guests.upsertRsvp({ guestId: guest.id, functionId: fn.id, status, headcount });
      }
      const scope = targetFunction
        ? targetFunction.name
        : `all ${targets.length} function${targets.length === 1 ? "" : "s"}`;
      setExtraBubbles((prev) => [
        ...prev,
        { id: prev.length * 2 + 1, from: "guest", text: label },
        { id: prev.length * 2 + 2, from: "business", text: `Thanks ${firstName}! We've marked you as ${statusPhrase[status]} for ${scope}. You can change this anytime.` },
      ]);
      onRsvpChanged?.();
    } finally {
      setSaving(false);
    }
  }

  const businessName = data?.connection?.displayName ?? "Avora Events";
  const initials = businessName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-background p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label={`WhatsApp preview for ${guest.name}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Preview as guest</h2>
            <p className="text-sm text-muted">How {guest.name} sees this on WhatsApp. Quick replies really update the RSVP.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-full px-2 py-1 text-muted hover:bg-surface hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Phone frame */}
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border-8 border-neutral-900 bg-neutral-900 shadow-xl">
          {/* WhatsApp header */}
          <div className="flex items-center gap-3 bg-[#075e54] px-3 py-2.5 text-white">
            <span aria-hidden>‹</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-xs font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{businessName}</p>
              <p className="text-[11px] text-white/75">online</p>
            </div>
          </div>

          {/* Thread */}
          <div ref={threadRef} className="h-96 space-y-2 overflow-y-auto bg-[#e5ddd5] p-3">
            <p className="mx-auto w-fit rounded-md bg-[#fdf3c7] px-2 py-0.5 text-center text-[10px] text-neutral-600">
              Simulation — nothing is really sent
            </p>

            <ChatBubble from="business">{rendered}</ChatBubble>

            {/* Quick replies, WhatsApp interactive-button style */}
            <div className="flex flex-col items-center gap-1.5 py-1">
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr.status}
                  type="button"
                  disabled={saving}
                  onClick={() => reply(qr.status, qr.label)}
                  className="w-11/12 rounded-lg bg-white py-2 text-sm font-medium text-[#00a884] shadow-sm transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  {qr.label}
                </button>
              ))}
            </div>

            {extraBubbles.map((b) => (
              <ChatBubble key={b.id} from={b.from}>
                {b.text}
              </ChatBubble>
            ))}
          </div>

          {/* Fake composer */}
          <div className="flex items-center gap-2 bg-[#f0f0f0] px-3 py-2">
            <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-sm text-neutral-400">Message</div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00a884] text-sm text-white" aria-hidden>
              🎤
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-muted">
          {targetFunction
            ? `Quick replies RSVP to ${targetFunction.name}.`
            : `Quick replies RSVP to every function (${functions.length}).`}
        </p>
      </aside>
    </div>
  );
}

function ChatBubble({ from, children }: { from: "business" | "guest"; children: ReactNode }) {
  const isGuest = from === "guest";
  return (
    <div
      className={`w-fit max-w-[85%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-sm text-neutral-900 shadow-sm ${
        isGuest ? "ml-auto rounded-tr-none bg-[#dcf8c6]" : "rounded-tl-none bg-white"
      }`}
    >
      {children}
      <span className="ml-2 align-bottom text-[10px] text-neutral-400">now{isGuest ? " ✓✓" : ""}</span>
    </div>
  );
}
