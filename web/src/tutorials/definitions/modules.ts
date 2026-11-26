import { linear } from "./linear";

/** Tutorials of the modules other than inventory. Steps follow the screens of each module. */
export const MODULE_TUTORIALS = {
  fleetMotos: linear("fleet", "fleetMotos", ["list", "search", "record", "options"]),
  scheduleWeek: linear("scheduling", "scheduleWeek", [
    "risk",
    "assign",
    "plan",
    "pending",
    "interventions",
  ]),
  registerIntervention: linear("scheduling", "registerIntervention", [
    "open",
    "new",
    "fill",
    "save",
  ]),
  importRisk: linear("scheduling", "importRisk", ["open", "file", "check", "confirm"]),
  labReceive: linear("lab", "labReceive", ["open", "code", "receive", "noPaddle"]),
  labCount: linear("lab", "labCount", ["open", "scan", "recent", "fix"]),
  labPcr: linear("lab", "labPcr", ["open", "pick", "results"]),
  trainings: linear("people", "trainings", ["courses", "requirements", "people"]),
  evaluations: linear("people", "evaluations", ["open", "pick", "review"]),
  users: linear("people", "users", ["open", "search", "record", "new"]),
  quadrantList: linear("quadrants", "quadrantList", ["list", "search", "actions"]),
  quadrantVersions: linear("quadrants", "quadrantVersions", ["open", "review"]),
  quadrantMap: linear("quadrants", "quadrantMap", [
    "open",
    "quadrant",
    "block",
    "point",
    "measure",
    "undo",
    "save",
  ]),
  incidentFlow: linear("incidents", "incidentFlow", ["list", "tabs", "open", "actions"]),
  centers: linear("settings", "centers", ["list", "open", "close"]),
  roles: linear("settings", "roles", ["open", "pick", "matrix"]),
  rules: linear("settings", "rules", ["open", "pick", "edit"]),
} as const;
