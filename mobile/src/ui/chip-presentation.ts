import type { MessageKey } from "@wolbachia/i18n";

import type { IconName } from "./icon-paths.ts";
import type { ChipState } from "../sync/chip-state.ts";

export type ChipTone = "success" | "warning" | "critical";

export interface ChipPresentation {
  readonly tone: ChipTone;
  readonly icon: IconName;
  readonly messageKey: MessageKey;
  readonly params: Readonly<Record<string, number>>;
}

/**
 * What the chip looks like for each state. Every state has its own icon and words, so the meaning
 * never depends on color alone.
 */
export function presentChip(state: ChipState): ChipPresentation {
  switch (state.kind) {
    case "allSent":
      return { tone: "success", icon: "cloudOk", messageKey: "mobile.chip.allSent", params: {} };
    case "toUpload":
      return {
        tone: "warning",
        icon: "cloudUp",
        messageKey: "mobile.chip.toUpload",
        params: { count: state.count },
      };
    case "noSignal":
      return {
        tone: "warning",
        icon: "noSignal",
        messageKey: state.count > 0 ? "mobile.chip.noSignal" : "mobile.chip.noSignalEmpty",
        params: { count: state.count },
      };
    case "error":
      return { tone: "critical", icon: "alert", messageKey: "mobile.chip.error", params: {} };
  }
}
