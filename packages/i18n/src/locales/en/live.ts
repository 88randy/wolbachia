/** English messages of the `live` area: exactly the keys of `../es-MX/live.ts`. */
import type { live as source } from "../es-MX/live.ts";

export const live: Record<keyof typeof source, string> = {
  "live.title": "Today's shifts",
  "live.description": "Couriers working now: {count}. It refreshes by itself every 30 seconds.",
  "live.note":
    "We show the quadrants each courier works today. When a shift ends, it leaves this page.",
  "live.listTitle": "In the field",
  "live.working": "Working",
  "live.since": "Started at {time}",
  "live.quadrants": "Quadrants: {list}",
  "live.focus": "Show only their area",
  "live.showAll": "Show everyone",
  "live.details": "See shift",
  "live.mapTitle": "Work areas",
  "live.noMap": "No assigned quadrants to show.",
  "live.empty": "Nobody is working right now.",
  "live.position.recent": "Last position: {minutes} min ago",
  "live.position.stale": "No new position: {minutes} min ago",
  "live.position.none": "We have not received their position yet.",
  "live.position.staleLabel": "{name} · {minutes} min ago",
  "live.legend.recent": "Filled dot: position from the last {minutes} min.",
  "live.legend.stale": "Hollow dashed dot: no new position for more than {minutes} min.",
  "live.position.error": "We could not load the positions. It retries every 30 seconds.",
  "live.track.error": "We could not load this courier's track. It retries every 2 minutes.",
};
