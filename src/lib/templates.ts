// Pure helpers for message templates. No store/service access.

export const PLACEHOLDERS = [
  { token: "{{guest_name}}", description: "The guest's name" },
  { token: "{{function_name}}", description: "The targeted function (or the event name)" },
  { token: "{{event_name}}", description: "The event name" },
] as const;

export interface TemplateContext {
  guestName: string;
  functionName?: string;
  eventName: string;
}

/** Fills placeholders. `{{function_name}}` falls back to the event name when
 * the campaign isn't tied to one function. Unknown tokens are left as-is. */
export function renderTemplate(body: string, ctx: TemplateContext): string {
  const values: Record<string, string> = {
    guest_name: ctx.guestName,
    name: ctx.guestName, // legacy alias
    function_name: ctx.functionName ?? ctx.eventName,
    event_name: ctx.eventName,
    event: ctx.eventName, // legacy alias
  };
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => values[key.toLowerCase()] ?? match);
}

/** Placeholder tokens a body uses that we don't know how to fill. */
export function unknownPlaceholders(body: string): string[] {
  const known = new Set(["guest_name", "name", "function_name", "event_name", "event"]);
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) {
    if (!known.has(m[1].toLowerCase())) found.add(m[0]);
  }
  return Array.from(found);
}
