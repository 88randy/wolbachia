import type { MessageKey } from "@wolbachia/i18n";
import {
  Ban,
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  CircleAlert,
  CircleHelp,
  CircleX,
  CloudCheck,
  CloudUpload,
  Eye,
  Search,
  Smartphone,
  TriangleAlert,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { CalendarStatus } from "../features/calendar/domain.ts";
import type { BadgeTone } from "./Badge.tsx";

export interface StatusPresentation {
  readonly tone: BadgeTone;
  readonly icon: LucideIcon;
  readonly label: MessageKey;
}

/**
 * D4 (#373): the ONE status table of P28, P29 and P33. Status is always icon + words; no two
 * statuses share both tone and icon. D2: accepted server decisions (`reviewed`) say "Aceptado".
 */
export const STATUS_PRESENTATION: Readonly<Record<CalendarStatus, StatusPresentation>> = {
  pending: { tone: "neutral", icon: Smartphone, label: "mobile.status.pending" },
  sending: { tone: "info", icon: CloudUpload, label: "mobile.status.sending" },
  error: { tone: "critical", icon: CircleAlert, label: "mobile.status.error" },
  sent: { tone: "success", icon: CloudCheck, label: "mobile.history.received" },
  in_review: { tone: "warning", icon: Search, label: "sync.inbox.inReviewTitle" },
  rejected: { tone: "critical", icon: CircleX, label: "sync.inbox.rejectedTitle" },
  reviewed: { tone: "success", icon: BadgeCheck, label: "mobile.calendar.statusAccepted" },
  voided: { tone: "neutral", icon: Ban, label: "mobile.history.voided" },
  observed: { tone: "warning", icon: Eye, label: "mobile.history.observed" },
  scheduled: { tone: "info", icon: CalendarClock, label: "mobile.calendar.statusScheduled" },
  done: { tone: "success", icon: CalendarCheck, label: "mobile.calendar.statusDone" },
  missed: { tone: "warning", icon: TriangleAlert, label: "mobile.calendar.statusMissed" },
  unconfirmed: { tone: "neutral", icon: CircleHelp, label: "mobile.calendar.statusUnconfirmed" },
};

/** Rows that need the courier's attention link to the inbox (P28), where the actions live. */
export const INBOX_STATUSES: readonly CalendarStatus[] = ["rejected", "error", "in_review"];
