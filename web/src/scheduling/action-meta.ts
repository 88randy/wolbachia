import { Bug, ClipboardCheck, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tone } from "../ui/tone";

export type ActionId = "check" | "place" | "release";
export type RiskLevel = "high" | "medium" | "low" | "none";

/** One icon per action, so the legend and the list say the same thing with icon and words. */
export const ACTION_ICON: Record<ActionId, LucideIcon> = {
  check: ClipboardCheck,
  place: MapPin,
  release: Bug,
};

export const ACTION_ORDER: readonly ActionId[] = ["check", "place", "release"];

export const RISK_TONE: Record<RiskLevel, Tone> = {
  high: "critical",
  medium: "warning",
  low: "success",
  none: "neutral",
};
