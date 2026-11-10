/** English messages of the `hub` area: exactly the keys of `../es-MX/hub.ts`. */
import type { hub as source } from "../es-MX/hub.ts";

export const hub: Record<keyof typeof source, string> = {
  "hub.home.greeting": "Hi, {name}",
  "hub.home.subtitle": "This is what needs your attention today.",
  "hub.home.shortcuts": "Shortcuts",
  "hub.card.open": "Open",

  "hub.inventory.description": "Supplies, lots, locations and warehouse movements.",
  "hub.inventory.transfers": "Send and receive material between locations.",
  "hub.inventory.discrepancies": "Differences between what was sent and received.",
  "hub.inventory.assignments": "Hand out material to couriers and centers.",
  "hub.inventory.reconciliations": "Match what was handed out against what was used.",
  "hub.inventory.writeOffs": "Write off damaged or expired material.",
  "hub.inventory.supplies": "Supply types and their usage rules.",
  "hub.inventory.lots": "Received lots, expiry and conditions.",
  "hub.inventory.locations": "Warehouses, centers and storage points.",

  "hub.operations.description": "Shifts, reviews and relocations of field work.",
  "hub.operations.reviews": "Records that need a decision.",
  "hub.operations.relocations": "Requests to move ovitraps.",
  "hub.operations.shifts": "Closed shifts and their daily summary.",

  "hub.lab.description": "Bag reception, egg counts and lab write-offs.",
  "hub.lab.bags": "Receive the bags that arrive from the field.",
  "hub.lab.eggCounts": "Count the eggs on each egg paddle.",
  "hub.lab.writeOffs": "Dispose of lab bags and material.",
  "hub.lab.history": "Review and correct previous counts.",

  "hub.people.description": "Staff trainings and evaluations.",
  "hub.people.trainings": "Courses, attendees and validity.",
  "hub.people.evaluations": "Field observations with their rubric.",

  "hub.fleet.description": "Motorcycles, inspections and services.",
  "hub.fleet.motorcycles": "Status of each motorcycle, inspections and services.",

  "hub.releases.description": "Release permits and their types.",
  "hub.releases.permits": "Active, expiring and suspended permits.",
  "hub.releases.permitTypes": "Permit types and their requirements.",

  "hub.quadrants.description": "Quadrant map, points and closures.",
  "hub.notifications.description": "Notices and alerts for you.",
  "hub.incidents.description": "Open incidents and their follow-up.",
  "hub.settings.description": "Organization, roles, phones and rules.",
  "hub.settings.incidentTypes": "Incident types, severity and owners.",
};
