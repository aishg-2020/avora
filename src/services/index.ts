import { mockServices } from "./mock";
import type { Services } from "./types";

// Single switch point for the data layer. Only mocks exist in this phase;
// real implementations get added here later.
export function getServices(): Services {
  return mockServices;
}

// The prototype works on one event at a time.
export const CURRENT_EVENT_ID = "evt_1";

export type { Services } from "./types";
