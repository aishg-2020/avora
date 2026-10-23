"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge, Button, Field, Modal, inputClassName } from "@/components/ui";
import { formatINR } from "@/lib/format";
import { SIDES } from "@/lib/guest-helpers";
import { COST_PER_RECIPIENT_INR } from "@/lib/pricing";
import { renderTemplate } from "@/lib/template";
import type { CampaignAudience, Guest, Side, TemplateCategory } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

type Step = "template" | "audience" | "review";
type AudienceKind = CampaignAudience["kind"];

const NEW_TEMPLATE = "__new__";
const PLACEHOLDER_HINT = "{{guest_name}} and {{function_name}} are replaced per recipient.";

export function NewCampaignModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: (campaignId: string) => void;
}) {
  const { data, reload: reloadStatic } = useAsyncData(() => {
    const { events, guests, messaging } = getServices();
    return Promise.all([
      messaging.listTemplates(),
      events.listFunctions(CURRENT_EVENT_ID),
      guests.listParties(CURRENT_EVENT_ID),
      guests.listGuests(CURRENT_EVENT_ID),
      events.getEvent(CURRENT_EVENT_ID),
    ]);
  }, []);
  const [templates, functions, parties, guestList, event] = data ?? [[], [], [], [], undefined];

  const allTags = useMemo(
    () =>
      Array.from(new Set([...parties.flatMap((p) => p.tags), ...guestList.flatMap((g) => g.tags ?? [])])).sort(),
    [parties, guestList],
  );

  const [step, setStep] = useState<Step>("template");
  const [error, setError] = useState<string | null>(null);

  // Step 1: template
  const [templateId, setTemplateId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<TemplateCategory>("utility");
  const [newBody, setNewBody] = useState("");

  // Step 2: audience
  const [kind, setKind] = useState<AudienceKind>("all");
  const [functionId, setFunctionId] = useState("");
  const [side, setSide] = useState<Side>("bride");
  const [tag, setTag] = useState("International");
  // Last audience we resolved recipients for; displayed only while it still
  // matches the current selection, so stale lists never flash.
  const [resolved, setResolved] = useState<{ key: string; list: Guest[] } | null>(null);

  // Step 3
  const [campaignName, setCampaignName] = useState("");
  const [sending, setSending] = useState(false);

  const audience: CampaignAudience | null = useMemo(() => {
    switch (kind) {
      case "all":
        return { kind: "all" };
      case "function":
        return functionId ? { kind: "function", functionId } : null;
      case "side":
        return { kind: "side", side };
      case "tag":
        return tag ? { kind: "tag", tag } : null;
    }
  }, [kind, functionId, side, tag]);

  // Live recipient preview whenever the audience changes.
  const audienceKey = audience ? JSON.stringify(audience) : null;
  useEffect(() => {
    if (!open || !audience || !audienceKey) return;
    let cancelled = false;
    getServices()
      .messaging.previewRecipients(CURRENT_EVENT_ID, audience)
      .then((list) => {
        if (!cancelled) setResolved({ key: audienceKey, list });
      });
    return () => {
      cancelled = true;
    };
  }, [open, audience, audienceKey]);
  const recipients = resolved && resolved.key === audienceKey ? resolved.list : null;

  const creatingTemplate = templateId === NEW_TEMPLATE;
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const effectiveBody = creatingTemplate ? newBody : selectedTemplate?.body ?? "";
  const effectiveTemplateName = creatingTemplate ? newName : selectedTemplate?.name ?? "";

  const targetFunction = functions.find((f) => f.id === (kind === "function" ? functionId : ""));
  const sampleGuest = recipients?.[0];
  const samplePreview = renderTemplate(effectiveBody, {
    guestName: sampleGuest?.name ?? "Guest",
    functionName: targetFunction?.name ?? event?.name ?? "the celebrations",
    eventName: event?.name ?? "the celebrations",
    room: "101",
    hotel: "Rambagh Palace",
  });

  const estimatedCost = (recipients?.length ?? 0) * COST_PER_RECIPIENT_INR;

  function goToAudience() {
    if (creatingTemplate) {
      if (!newName.trim() || !newBody.trim()) {
        setError("Give the new template a name and a message body.");
        return;
      }
    } else if (!selectedTemplate) {
      setError("Pick a template or create a new one.");
      return;
    }
    setError(null);
    setStep("audience");
  }

  function goToReview() {
    if (!audience) {
      setError(kind === "function" ? "Pick a function." : "Pick a tag.");
      return;
    }
    setError(null);
    if (!campaignName.trim()) setCampaignName(effectiveTemplateName);
    setStep("review");
  }

  async function confirmSend() {
    if (!audience || (recipients?.length ?? 0) === 0) return;
    setSending(true);
    setError(null);
    try {
      const { messaging } = getServices();
      let finalTemplateId = templateId;
      if (creatingTemplate) {
        const created = await messaging.createTemplate({ name: newName, category: newCategory, body: newBody });
        finalTemplateId = created.id;
        reloadStatic();
      }
      const campaign = await messaging.createCampaign({
        eventId: CURRENT_EVENT_ID,
        name: campaignName || effectiveTemplateName,
        templateId: finalTemplateId,
        audience,
      });
      await messaging.sendCampaign(campaign.id);
      onSent(campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSending(false);
    }
  }

  const stepIndex = step === "template" ? 1 : step === "audience" ? 2 : 3;

  return (
    <Modal open={open} onClose={onClose} title={`New campaign · step ${stepIndex} of 3`} wide>
      {step === "template" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Choose the message to send. {PLACEHOLDER_HINT}</p>
          <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {templates.map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer rounded-lg border p-3 transition ${
                  templateId === t.id ? "border-accent" : "border-border hover:border-accent/50"
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  className="sr-only"
                  checked={templateId === t.id}
                  onChange={() => setTemplateId(t.id)}
                />
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  <Badge>{t.category}</Badge>
                </div>
                <p className="text-xs text-muted">{t.body}</p>
              </label>
            ))}
            <label
              className={`cursor-pointer rounded-lg border border-dashed p-3 transition ${
                creatingTemplate ? "border-accent" : "border-border hover:border-accent/50"
              }`}
            >
              <input
                type="radio"
                name="template"
                className="sr-only"
                checked={creatingTemplate}
                onChange={() => setTemplateId(NEW_TEMPLATE)}
              />
              <span className="text-sm font-medium">+ New template…</span>
              <p className="text-xs text-muted">Write a fresh message with placeholders.</p>
            </label>
          </div>

          {creatingTemplate && (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Template name">
                  <input className={inputClassName} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Sangeet reminder" />
                </Field>
                <Field label="Category">
                  <select className={inputClassName} value={newCategory} onChange={(e) => setNewCategory(e.target.value as TemplateCategory)}>
                    <option value="utility">utility</option>
                    <option value="marketing">marketing</option>
                  </select>
                </Field>
              </div>
              <Field label="Message body" hint={PLACEHOLDER_HINT}>
                <textarea
                  className={`${inputClassName} min-h-24`}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Hi {{guest_name}}, see you at {{function_name}}!"
                />
              </Field>
              <div className="flex gap-2">
                {["{{guest_name}}", "{{function_name}}"].map((ph) => (
                  <Button key={ph} variant="secondary" onClick={() => setNewBody((b) => `${b}${b.endsWith(" ") || b === "" ? "" : " "}${ph}`)}>
                    Insert {ph}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={goToAudience}>
              Next: audience
            </Button>
          </div>
        </div>
      )}

      {step === "audience" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Who should receive “{effectiveTemplateName}”?</p>
          <div className="space-y-2">
            <AudienceOption checked={kind === "all"} onSelect={() => setKind("all")} label="All guests" />
            <AudienceOption checked={kind === "function"} onSelect={() => setKind("function")} label="Attending a specific function">
              {kind === "function" && (
                <select className={inputClassName} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
                  <option value="">Pick a function…</option>
                  {functions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </AudienceOption>
            <AudienceOption checked={kind === "side"} onSelect={() => setKind("side")} label="By side">
              {kind === "side" && (
                <select className={inputClassName} value={side} onChange={(e) => setSide(e.target.value as Side)}>
                  {SIDES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </AudienceOption>
            <AudienceOption checked={kind === "tag"} onSelect={() => setKind("tag")} label="By tag">
              {kind === "tag" && (
                <select className={inputClassName} value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="International">International</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </AudienceOption>
          </div>

          <p className="text-sm">
            {recipients === null ? (
              <span className="text-muted">Select an audience to see who it reaches.</span>
            ) : (
              <>
                <strong>{recipients.length}</strong> recipient{recipients.length === 1 ? "" : "s"} ·{" "}
                {formatINR(COST_PER_RECIPIENT_INR)} each · est. <strong>{formatINR(estimatedCost)}</strong>
              </>
            )}
          </p>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep("template")}>
              Back
            </Button>
            <Button variant="primary" onClick={goToReview}>
              Next: review
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <Field label="Campaign name">
            <input className={inputClassName} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted">Template</p>
              <p className="font-medium">{effectiveTemplateName}</p>
            </div>
            <div>
              <p className="text-muted">Audience</p>
              <p className="font-medium">
                {kind === "all" && "All guests"}
                {kind === "function" && `Attending: ${targetFunction?.name}`}
                {kind === "side" && `Side: ${side}`}
                {kind === "tag" && `Tag: ${tag}`}
              </p>
            </div>
            <div>
              <p className="text-muted">Recipients</p>
              <p className="font-medium">{recipients?.length ?? 0}</p>
            </div>
            <div>
              <p className="text-muted">Estimated cost</p>
              <p className="font-medium">
                {formatINR(estimatedCost)} <span className="font-normal text-muted">({formatINR(COST_PER_RECIPIENT_INR)}/recipient)</span>
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-muted">
              Message preview{sampleGuest ? ` (as ${sampleGuest.name})` : ""}
            </p>
            <div className="w-fit max-w-full rounded-lg rounded-tl-none bg-surface px-3 py-2 text-sm shadow-sm">
              {samplePreview || <span className="text-muted">—</span>}
            </div>
          </div>

          {recipients && recipients.length > 0 ? (
            <p className="text-xs text-muted">
              Sending to: {recipients.slice(0, 6).map((g) => g.name).join(", ")}
              {recipients.length > 6 && ` and ${recipients.length - 6} more`}
            </p>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-400">No recipients match this audience.</p>
          )}

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep("audience")} disabled={sending}>
              Back
            </Button>
            <Button variant="primary" onClick={confirmSend} disabled={sending || (recipients?.length ?? 0) === 0}>
              {sending ? "Sending…" : `Confirm & send to ${recipients?.length ?? 0}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AudienceOption({
  checked,
  onSelect,
  label,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 transition ${checked ? "border-accent" : "border-border"}`}>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input type="radio" name="audience" checked={checked} onChange={onSelect} />
        {label}
      </label>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
