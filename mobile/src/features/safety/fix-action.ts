import { HardDrive, MapPin, Wifi } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { openSystemSetting } from "../../system-settings/open-system-setting.ts";
import { requestLocationPermission } from "../../system-settings/request-permission.ts";
import type { GlobalCause } from "./global-state.ts";

export interface FixAction {
  readonly icon: LucideIcon;
  readonly labelKey: MessageKey;
  /** Runs the fix; `recheck` makes the app read the setting again right away. */
  readonly run: (recheck: () => void) => Promise<void>;
}

const OPEN = (target: Parameters<typeof openSystemSetting>[0]) => async (recheck: () => void) => {
  await openSystemSetting(target);
  recheck();
};

const ACTIONS: Readonly<Partial<Record<GlobalCause, FixAction>>> = {
  gpsOff: { icon: MapPin, labelKey: "mobile.global.fixEnableLocation", run: OPEN("location") },
  gpsDenied: {
    icon: MapPin,
    labelKey: "mobile.global.fixAllowLocation",
    run: async (recheck) => {
      await requestLocationPermission();
      recheck();
    },
  },
  storageFull: { icon: HardDrive, labelKey: "mobile.global.fixFreeSpace", run: OPEN("storage") },
  storageLow: { icon: HardDrive, labelKey: "mobile.global.fixFreeSpace", run: OPEN("storage") },
  noSignal: { icon: Wifi, labelKey: "mobile.global.fixNetwork", run: OPEN("network") },
};

/** The button a warning offers to fix the phone setting behind it; null when there is none. */
export function fixActionFor(cause: GlobalCause): FixAction | null {
  return ACTIONS[cause] ?? null;
}
