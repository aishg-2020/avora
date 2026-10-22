// Client-side persisted data store. This is the single source of truth for
// every entity the mock service layer exposes. It is intentionally "dumb":
// it only knows how to hold state, persist it to localStorage, and reset it
// back to the seed data. All business logic (lookups, validation, cascading
// deletes, id generation, ...) lives in `src/services/mock.ts`, which is the
// only module allowed to read/write this store directly. UI code must never
// import this module — it should call `getServices()` instead.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import * as seed from "@/mocks/data";
import type {
  Baggage,
  CallLog,
  Campaign,
  CheckIn,
  Event,
  EventFunction,
  Guest,
  IdDocument,
  Message,
  MessageTemplate,
  Party,
  Room,
  Rsvp,
  Travel,
  WhatsAppConnection,
} from "@/lib/types";

export interface DataState {
  events: Event[];
  functions: EventFunction[];
  parties: Party[];
  guests: Guest[];
  rsvps: Rsvp[];
  travel: Travel[];
  idDocuments: IdDocument[];
  rooms: Room[];
  baggage: Baggage[];
  checkIns: CheckIn[];
  templates: MessageTemplate[];
  campaigns: Campaign[];
  messages: Message[];
  callLogs: CallLog[];
  whatsapp: WhatsAppConnection;
}

interface DataActions {
  /** Wipes whatever is in the store (and localStorage) and restores the
   * original seed data from `src/mocks/data.ts`. */
  resetDemoData: () => void;
}

export type DataStore = DataState & DataActions;

// Deep-clone the seed module every time so nothing ever mutates the
// original arrays/objects exported from `src/mocks/data.ts`.
function seedState(): DataState {
  return {
    events: structuredClone(seed.events),
    functions: structuredClone(seed.functions),
    parties: structuredClone(seed.parties),
    guests: structuredClone(seed.guests),
    rsvps: structuredClone(seed.rsvps),
    travel: structuredClone(seed.travel),
    idDocuments: structuredClone(seed.idDocuments),
    rooms: structuredClone(seed.rooms),
    baggage: structuredClone(seed.baggage),
    checkIns: structuredClone(seed.checkIns),
    templates: structuredClone(seed.templates),
    campaigns: structuredClone(seed.campaigns),
    messages: structuredClone(seed.messages),
    callLogs: structuredClone(seed.callLogs),
    whatsapp: structuredClone(seed.whatsapp),
  };
}

export const STORAGE_KEY = "avora:demo-data";

// SSR-safe storage: Next.js renders client components once on the server
// (no `window`), so every method here has to no-op there instead of
// throwing on `localStorage` being undefined.
const safeStorage = {
  getItem(name: string) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(name);
  },
  setItem(name: string, value: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(name, value);
  },
  removeItem(name: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
  },
};

export const useDataStore = create<DataStore>()(
  persist(
    (set) => ({
      ...seedState(),
      resetDemoData: () => set(() => seedState()),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      // Bump whenever the persisted shape changes incompatibly. Older
      // snapshots are simply replaced with fresh seed data — it's demo data,
      // so a reset is friendlier than a broken page.
      version: 3,
      migrate: (persisted, version) => (version < 3 ? seedState() : (persisted as DataState)),
      // Never persist the action creators, only the entity data.
      partialize: (state) => {
        const data: Partial<DataStore> = { ...state };
        delete data.resetDemoData;
        return data as DataState;
      },
    },
  ),
);

// Resolves once the persisted state (if any) has been read from
// localStorage and merged into the store. The mock service layer awaits
// this before its first read/write on every call so pages never race the
// async rehydration zustand's `persist` middleware does on mount.
export const dataStoreReady: Promise<void> =
  typeof window === "undefined"
    ? Promise.resolve()
    : new Promise((resolve) => {
        if (useDataStore.persist.hasHydrated()) {
          resolve();
          return;
        }
        const unsubscribe = useDataStore.persist.onFinishHydration(() => {
          unsubscribe();
          resolve();
        });
      });

// Small helper for generating stable-enough ids for new records created in
// the browser. Not cryptographically unique, just unique within a demo
// session, which is all this prototype needs.
let counter = 0;
export function genId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
