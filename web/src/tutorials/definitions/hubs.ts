import type { Tutorial, TutorialStep } from "../types";

/** A hub step with no clip of its own: it shows the clip already recorded for a screen of the area. */
function reuse(
  id: string,
  clipFrom: NonNullable<TutorialStep["clipFrom"]>,
  next?: string,
): TutorialStep {
  return { id, clipFrom, next: next ? [next] : [] };
}

/** Guides of the area home pages. They only point at clips that the screen tutorials already have. */
export const HUB_TUTORIALS = {
  inventoryHub: {
    id: "inventoryHub",
    module: "inventory",
    steps: [
      reuse(
        "receive",
        { module: "inventory", tutorial: "receiveSupplies", step: "new" },
        "transfer",
      ),
      reuse(
        "transfer",
        { module: "inventory", tutorial: "moveTransfer", step: "prepare" },
        "deliver",
      ),
      reuse(
        "deliver",
        { module: "inventory", tutorial: "courierDelivery", step: "prepare" },
        "reconcile",
      ),
      reuse(
        "reconcile",
        { module: "inventory", tutorial: "courierDelivery", step: "reconcile" },
        "setup",
      ),
      reuse("setup", { module: "inventory", tutorial: "createLocation", step: "new" }),
    ],
  },
  fleetHub: {
    id: "fleetHub",
    module: "fleet",
    steps: [
      reuse("list", { module: "fleet", tutorial: "fleetMotos", step: "list" }, "record"),
      reuse("record", { module: "fleet", tutorial: "fleetMotos", step: "record" }),
    ],
  },
} as const satisfies Record<string, Tutorial>;
