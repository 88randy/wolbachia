import type { incidentTypes as Spanish } from "../es-MX/incidentTypes.ts";
export const incidentTypes = {
  "incidentTypes.page.title": "Incident types",
  "incidentTypes.page.create": "New type",
  "incidentTypes.page.unconfigured": "Types awaiting configuration",
  "incidentTypes.form.configure": "Configure type",
  "incidentTypes.form.chooseSeverity": "Select the severity",
  "incidentTypes.form.retainedBlockers":
    "This configuration includes system-managed blockers. They remain unchanged when you edit other fields.",
  "incidentTypes.form.offline":
    "There is no connection. Your input is retained; reconnect and verify the current configuration before saving.",
  "incidentTypes.form.verifying":
    "The authorized configuration is being verified. Wait for a current response before saving.",
  "incidentTypes.field.code": "Exact code",
  "incidentTypes.field.label": "Name",
  "incidentTypes.field.icon": "Icon",
  "incidentTypes.field.severity": "Default severity",
  "incidentTypes.field.supervisor": "Responsible supervisor",
  "incidentTypes.field.coordinator": "Responsible coordinator",
  "incidentTypes.field.terminal": "Terminal owner",
  "incidentTypes.field.supervisorSla": "Supervisor response (seconds)",
  "incidentTypes.field.coordinatorSla": "Coordinator response (seconds)",
  "incidentTypes.field.reportEvidence": "Photos to report",
  "incidentTypes.field.closeEvidence": "Photos to close",
  "incidentTypes.field.blockers": "While open, blocks",
  "incidentTypes.field.active": "Active type",
  "incidentTypes.form.label": "Type configuration",
  "incidentTypes.form.save": "Save version",
  "incidentTypes.form.saved": "Version saved",
  "incidentTypes.form.revision": "Current revision:",
  "incidentTypes.form.review": "Review current configuration",
  "incidentTypes.form.retainedRules":
    "Changes apply to new incidents. Previous incidents retain the version captured when they were created.",
  "incidentTypes.form.reminder":
    "Escalation: supervisor, coordinator and terminal owner. The final level sends an hourly reminder until resolution.",
  "incidentTypes.form.protectedOther":
    "Other always exists: its name, icon and active state are protected.",
  "incidentTypes.form.noBlockers": "No configured blockers",
  "incidentTypes.owner.search": "Find eligible owners",
  "incidentTypes.owner.choose": "Select a named owner",
  "incidentTypes.owner.skip": "Skip this level",
  "incidentTypes.owner.unavailable": "Owner unavailable; select an eligible person.",
  "incidentTypes.history.title": "Configuration history",
  "incidentTypes.history.empty":
    "There are no versions yet. Save the configuration to create the first.",
  "incidentTypes.error.field": "Review this field and save again.",
  "incidentTypes.error.validation": "Review the highlighted fields. Your input is still available.",
  "incidentTypes.error.conflict":
    "The configuration changed or does not allow this action. Review the current version before saving again.",
  "incidentTypes.error.terminal":
    "An administrator must configure an active eligible terminal owner. Select current owners or remove unavailable optional levels.",
  "incidentTypes.status.active": "Active",
  "incidentTypes.status.inactive": "Inactive",
  "incidentTypes.status.protected": "Always exists",
} satisfies Record<keyof typeof Spanish, string>;
