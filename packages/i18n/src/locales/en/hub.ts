/** English messages of the `hub` area: exactly the keys of `../es-MX/hub.ts`. */
import type { hub as source } from "../es-MX/hub.ts";

export const hub: Record<keyof typeof source, string> = {
  "hub.home.greeting": "Hi, {name}",
  "hub.home.subtitle": "This is what needs your attention today.",
  "hub.home.shortcuts": "Shortcuts",
  "hub.card.open": "Open",

  "hub.inventory.description":
    "Follow the path of the material: it arrives, is stored, moves and is handed out.",
  "hub.inventory.daily": "Everyday work",
  "hub.inventory.setup": "Setup",
  "hub.inventory.setupHint": "Done once, or when you open a new warehouse or supply.",
  "hub.inventory.setupMissing":
    "Before you start, create at least one warehouse and add the supplies you handle (below, in Setup).",
  "hub.inventory.pill.waiting": "Waiting",
  "hub.inventory.pill.attention": "Needs attention",
  "hub.inventory.step.receive.title": "Receive supplies",
  "hub.inventory.step.receive.text":
    "Record what arrives: which supply, how much, when it expires and which warehouse keeps it.",
  "hub.inventory.step.receive.empty": "There are no lots yet. Record the first one.",
  "hub.inventory.step.receive.count": "Lots recorded: {count}",
  "hub.inventory.step.receive.action": "Receive supplies",
  "hub.inventory.step.stock.title": "Stock",
  "hub.inventory.step.stock.text":
    "See what each warehouse has and everything that came in and went out.",
  "hub.inventory.step.stock.count": "Warehouses and locations: {count}",
  "hub.inventory.step.stock.action": "See stock",
  "hub.inventory.step.move.title": "Move between warehouses",
  "hub.inventory.step.move.text":
    "Send material from one warehouse to another and confirm what arrived, piece by piece.",
  "hub.inventory.step.move.count": "To send: {toSend}. To receive: {toReceive}.",
  "hub.inventory.step.move.action": "Move material",
  "hub.inventory.step.differences.title": "Differences",
  "hub.inventory.step.differences.text":
    "When what arrived does not match what left, it is reviewed and resolved here.",
  "hub.inventory.step.differences.none": "There are no open differences.",
  "hub.inventory.step.differences.count": "Unresolved differences: {count}",
  "hub.inventory.step.differences.action": "See differences",
  "hub.inventory.step.deliver.title": "Hand out to couriers",
  "hub.inventory.step.deliver.text":
    "Pick the courier, check what they need that day and hand them the lots.",
  "hub.inventory.step.deliver.action": "Hand out material",
  "hub.inventory.step.reconcile.title": "Match deliveries",
  "hub.inventory.step.reconcile.text":
    "At the end of the day, compare what was handed out with what was used and returned.",
  "hub.inventory.step.reconcile.action": "Match the day",
  "hub.inventory.step.writeOff.title": "Losses and write-offs",
  "hub.inventory.step.writeOff.text":
    "Write off expired, damaged or lost material, with its reason and evidence.",
  "hub.inventory.step.writeOff.action": "Record a write-off",
  "hub.inventory.setup.locations.title": "Warehouses",
  "hub.inventory.setup.locations.text":
    "The places where material is kept, with their owner and map.",
  "hub.inventory.setup.locations.empty": "There are no warehouses. Create the first one.",
  "hub.inventory.setup.locations.count": "Registered: {count}",
  "hub.inventory.setup.supplies.title": "Supply catalog",
  "hub.inventory.setup.supplies.text":
    "The kinds of supply you handle: paddles, bags, eggs and their usage rules.",
  "hub.inventory.setup.supplies.empty": "There are no supplies. Add the first one.",
  "hub.inventory.setup.supplies.count": "Registered: {count}",

  "hub.operations.description": "Shifts, reviews and relocations of field work.",
  "hub.operations.reviews": "Records that need a decision.",
  "hub.operations.relocations": "Requests to move ovitraps.",
  "hub.operations.live": "Who is out in the field right now, and where.",
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
  "hub.releases.records": "Recorded releases with their permit, lot and map point.",
  "hub.releases.devices": "Release devices, their source lot and status.",
  "hub.community.description": "Community activities: notices, talks and meetings.",
  "hub.releases.permits": "Active, expiring and suspended permits.",
  "hub.releases.permitTypes": "Permit types and their requirements.",

  "hub.quadrants.description": "Quadrant map, points and closures.",
  "hub.notifications.description": "Notices and alerts for you.",
  "hub.incidents.description": "Open incidents and their follow-up.",
  "hub.portal.summary": "Overall program indicators.",
  "hub.portal.trends": "Releases by week.",
  "hub.portal.map": "Coverage by quadrant.",
  "hub.settings.description": "Organization, roles, phones and rules.",
  "hub.settings.incidentTypes": "Incident types, severity and owners.",
};
