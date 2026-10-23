// Placeholder rendering for message templates. Officially supported:
// {{guest_name}} and {{function_name}}. Legacy aliases ({{name}},
// {{function}}, {{event}}) and the hotel/room extras keep the seed
// templates rendering nicely. Unknown placeholders are left untouched so
// typos are visible in previews instead of silently vanishing.

export interface TemplateVars {
  guestName?: string;
  functionName?: string;
  eventName?: string;
  room?: string;
  hotel?: string;
}

export function renderTemplate(body: string, vars: TemplateVars): string {
  const map: Record<string, string | undefined> = {
    guest_name: vars.guestName,
    name: vars.guestName,
    function_name: vars.functionName,
    function: vars.functionName,
    event: vars.eventName,
    room: vars.room,
    hotel: vars.hotel,
  };
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => map[key.toLowerCase()] ?? match);
}
