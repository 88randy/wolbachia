import type { Tutorial } from "../types";

const yes = (to: string) => ({ to, edge: "yes" }) as const;
const no = (to: string) => ({ to, edge: "no" }) as const;

/** Inventory tutorials. Steps match the screens of `web/src/inventory`. */
export const INVENTORY_TUTORIALS = {
  receiveSupplies: {
    id: "receiveSupplies",
    module: "inventory",
    steps: [
      { id: "open", next: ["new"] },
      { id: "new", next: ["supply"] },
      { id: "supply", next: ["place"] },
      { id: "place", next: ["save"] },
      { id: "save", next: [] },
    ],
  },
  moveTransfer: {
    id: "moveTransfer",
    module: "inventory",
    steps: [
      { id: "prepare", next: ["items"] },
      { id: "items", next: ["sign"] },
      { id: "sign", next: ["transit"] },
      { id: "transit", hasClip: false, next: ["receive"] },
      { id: "receive", next: ["complete"] },
      { id: "complete", isDecision: true, hasClip: false, next: [yes("done"), no("diff")] },
      { id: "done", hasClip: false, next: [] },
      { id: "diff", hasClip: false, next: ["resolve"] },
      { id: "resolve", hasClip: false, next: [] },
    ],
  },
  resolveDiscrepancy: {
    id: "resolveDiscrepancy",
    module: "inventory",
    steps: [
      { id: "open", next: ["review"] },
      { id: "review", next: ["outcome"] },
      { id: "outcome", next: ["reason"] },
      { id: "reason", next: ["sign"] },
      { id: "sign", next: ["confirm"] },
      { id: "confirm", next: [] },
    ],
  },
  courierDelivery: {
    id: "courierDelivery",
    module: "inventory",
    steps: [
      { id: "prepare", next: ["sign"] },
      { id: "sign", next: ["mistake"] },
      { id: "mistake", isDecision: true, hasClip: false, next: [no("reconcile"), yes("void")] },
      { id: "reconcile", next: ["check"] },
      { id: "void", next: ["redo"] },
      { id: "check", isDecision: true, hasClip: false, next: [yes("done"), no("justify")] },
      { id: "redo", hasClip: false, next: [] },
      { id: "done", hasClip: false, next: [] },
      { id: "justify", next: [] },
    ],
  },
  writeOffs: {
    id: "writeOffs",
    module: "inventory",
    steps: [
      { id: "open", next: ["new"] },
      { id: "new", next: ["find"] },
      { id: "find", next: ["fill"] },
      { id: "fill", next: ["save"] },
      { id: "save", next: [] },
    ],
  },
  createLocation: {
    id: "createLocation",
    module: "inventory",
    steps: [
      { id: "open", next: ["new"] },
      { id: "new", next: ["data"] },
      { id: "data", next: ["place"] },
      { id: "place", next: ["save"] },
      { id: "save", next: [] },
    ],
  },
  suppliesCatalog: {
    id: "suppliesCatalog",
    module: "inventory",
    steps: [
      { id: "open", next: ["new"] },
      { id: "new", next: ["identity"] },
      { id: "identity", next: ["rules"] },
      { id: "rules", next: ["save"] },
      { id: "save", next: [] },
    ],
  },
} as const satisfies Record<string, Tutorial>;
