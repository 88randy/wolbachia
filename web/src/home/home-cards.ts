import type { MessageKey } from "@wolbachia/i18n";
import {
  Bike,
  ClockAlert,
  ListChecks,
  OctagonAlert,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LinkProps } from "@tanstack/react-router";
import type { Tone } from "../ui/tone";

export interface HomeCardConfig {
  title: MessageKey;
  description: MessageKey;
  icon: LucideIcon;
  tone: Tone;
  link: Pick<LinkProps, "to" | "search">;
  /** A pending card is work to do and only shows when its count is above zero. */
  isPending: boolean;
}

/**
 * How each summary card of `GET /home/summary/` looks and where it goes. The filters are the ones
 * the incident list understands; `escalated` has no list filter yet, so it opens the open list.
 */
export const HOME_CARDS: Readonly<Record<string, HomeCardConfig>> = {
  incidents_critical: {
    title: "discovery.card.incidents_critical.title",
    description: "discovery.card.incidents_critical.description",
    icon: OctagonAlert,
    tone: "critical",
    link: { to: "/incidents", search: { state: "open", severity: "critical" } },
    isPending: true,
  },
  incidents_overdue: {
    title: "discovery.card.incidents_overdue.title",
    description: "discovery.card.incidents_overdue.description",
    icon: ClockAlert,
    tone: "warning",
    link: { to: "/incidents", search: { overdue: "true" } },
    isPending: true,
  },
  incidents_escalated: {
    title: "discovery.card.incidents_escalated.title",
    description: "discovery.card.incidents_escalated.description",
    icon: TrendingUp,
    tone: "warning",
    link: { to: "/incidents", search: { state: "open" } },
    isPending: true,
  },
  incidents_open: {
    title: "discovery.card.incidents_open.title",
    description: "discovery.card.incidents_open.description",
    icon: TriangleAlert,
    tone: "info",
    link: { to: "/incidents", search: { state: "open" } },
    isPending: false,
  },
  tasks_pending_today: {
    title: "discovery.card.tasks_pending_today.title",
    description: "discovery.card.tasks_pending_today.description",
    icon: ListChecks,
    tone: "info",
    link: { to: "/dashboards/operations" },
    isPending: true,
  },
  couriers_in_field: {
    title: "discovery.card.couriers_in_field.title",
    description: "discovery.card.couriers_in_field.description",
    icon: Bike,
    tone: "neutral",
    link: { to: "/dashboards/operations" },
    isPending: false,
  },
};
