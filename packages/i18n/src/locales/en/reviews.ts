export const reviews = {
  "reviews.workspace.title": "Review queue",
  "reviews.workspace.detail": "Original record and decisions",
  "reviews.workspace.ingest": "Original ingest outcome",
  "reviews.workspace.current": "Current decision",
  "reviews.workspace.cause": "Review reason",
  "reviews.workspace.causeColumn": "Reason",
  "reviews.workspace.ingestColumn": "Original ingest",
  "reviews.workspace.search": "Search events or courier",
  "reviews.workspace.inReview": "In review",
  "reviews.workspace.rejected": "Rejected",
  "reviews.workspace.pending": "Pending",
  "reviews.workspace.accepted": "Accepted",
  "reviews.workspace.voided": "Voided",
  "reviews.workspace.event": "Event type",
  "reviews.workspace.courier": "Courier reference",
  "reviews.workspace.received": "Received at",
  "reviews.workspace.open": "Review event {id}",
  "reviews.workspace.listHint":
    "All original review causes are visible by default. Decisions do not change the original ingest outcome. Filters and paging are applied by the server.",
  "reviews.workspace.immutable":
    "The original capture, evidence and ingest outcome remain unchanged. Decisions are appended below.",
  "reviews.workspace.safety":
    "Acceptance is blocked. An authorized supervisor must resolve every mandatory safety, permit, training, zone or historical-authority requirement through its owning workflow; a review cannot override it.",
  "reviews.workspace.blocker": "Unresolved requirement: {code}",
  "reviews.workspace.original": "Original capture, evidence and provenance",
  "reviews.workspace.history": "Decision history",
  "reviews.workspace.unknown": "Unavailable author",
  "reviews.workspace.accept": "Accept",
  "reviews.workspace.void": "Void with reason",
  "reviews.workspace.openIncident": "Open incident",
  "reviews.workspace.auditOnly": "Audit only; pending operational resolution",
  "reviews.workspace.operational": "Operational decision",
  "reviews.workspace.incidentReceipt": "Created incident reference: {id}",
  "reviews.workspace.receipt": "Known effect receipt",
  "reviews.workspace.decisionEvidence": "Decision evidence references",
  "reviews.workspace.noDecisions":
    "No decisions yet. Review the original evidence before deciding.",
  "reviews.workspace.reason": "Decision reason",
  "reviews.workspace.reasonHint":
    "Use at least {min} visible characters. Refresh and review the current evidence after a conflict or interrupted request.",
  "reviews.workspace.refresh": "Refresh current evidence",
  "reviews.workspace.refreshHint":
    "Your reason is retained. Review current evidence before another deliberate decision; no request will be replayed.",
  "reviews.workspace.saved": "Decision recorded. Review the returned decision and effect receipt.",
  "reviews.workspace.denied":
    "This view requires review read permission and explicit center and quadrant scope. Ask an organization administrator to review access.",
  "reviews.workspace.consequence":
    "The server will recheck the original evidence, current authority and mandatory safety requirements before applying this immutable decision.",
  "reviews.workspace.operations": "Operations",
  "reviews.workspace.purpose": "Records the system flagged that wait for your decision.",
  "reviews.workspace.pick": "Pick a record from the list to see what happened and decide.",
  "reviews.workspace.closeDetail": "Close review details",
} as const;
