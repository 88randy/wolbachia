import type { evaluations as source } from "../es-MX/evaluations.ts";
export const evaluations: Record<keyof typeof source, string> = {
  "evaluations.history.attemptTable": "Attempt details",
  "evaluations.history.records": "Evaluation records",
  "evaluations.rubric.versionHistory": "Rubric versions",
  "evaluations.form.newRecord": "New evaluation",
  "evaluations.history.provenanceGap":
    "The attempts response omits its original rubric identity. Consult the evaluation row and its version history; do not use the rubric selected for a new entry as provenance for these attempts.",
  "evaluations.page.title": "Evaluation sheets",
  "evaluations.page.people": "People",
  "evaluations.page.trainings": "Trainings",
  "evaluations.page.hint":
    "Record observations and inspect results with their original rubric. The server calculates the result; an evaluation does not certify training.",
  "evaluations.page.denied":
    "You cannot access this context. Ask an administrator to review your permissions and scope.",
  "evaluations.page.private":
    "Evaluation history requires evaluation read permission. Entry permission does not grant access to history.",
  "evaluations.page.identifiers":
    "This service does not yet provide an authorized person and context directory for this task. Use exact identifiers; no names or private details are looked up.",
  "evaluations.rubric.percent": "%",
  "evaluations.rubric.separator": " · ",
  "evaluations.rubric.title": "Rubric and versions",
  "evaluations.rubric.code": "Exact rubric code",
  "evaluations.rubric.lookup": "Look up rubric",
  "evaluations.rubric.version": "Rubric version",
  "evaluations.rubric.select": "Use this version",
  "evaluations.rubric.threshold": "Passing threshold",
  "evaluations.rubric.effective": "Effective from",
  "evaluations.rubric.unconfigured":
    "A valid rubric has not been configured. An administrator must publish weights and critical checks before entry.",
  "evaluations.rubric.choose":
    "Explicitly select the version applicable to this observation. Previous versions retain their own weights.",
  "evaluations.rubric.checks": "Critical checks",
  "evaluations.form.title": "New evaluation",
  "evaluations.form.save": "Save evaluation",
  "evaluations.form.confirm":
    "Recording this observation retains an immutable attempt and may initiate a training notice. Review the person, context, rubric and answers.",
  "evaluations.form.review": "Review and save",
  "evaluations.form.invalid":
    "Review identifiers, the time zone and scores from 0 to 100. Your fields have been kept.",
  "evaluations.form.failed":
    "We could not confirm the record. Your fields have been kept. Check history before starting another attempt; nothing is resent automatically.",
  "evaluations.form.retry": "I checked history; enable another attempt",
  "evaluations.form.offline":
    "You are offline. Keep your fields and reconnect to record the observation.",
  "evaluations.form.scores":
    "Normalized scores from 0 to 100. An unanswered field stays incomplete; its weight is never redistributed.",
  "evaluations.form.blocked":
    "Select a configured rubric and an allowed context. An administrator can review configuration and scope.",
  "evaluations.field.subject": "Person",
  "evaluations.field.center": "Center",
  "evaluations.field.quadrant": "Quadrant (optional)",
  "evaluations.field.observed": "Observation date with time zone",
  "evaluations.field.instantHint":
    "Use an ISO 8601 date with Z or an explicit offset, for example 2026-11-09T12:00:00-06:00.",
  "evaluations.field.presentation": "Presentation",
  "evaluations.field.execution": "Execution",
  "evaluations.field.coverage": "Coverage",
  "evaluations.field.unanswered": "Unanswered",
  "evaluations.field.yes": "Meets requirement",
  "evaluations.field.no": "Critical failure",
  "evaluations.result.title": "Result",
  "evaluations.result.score": "Calculated score",
  "evaluations.result.pass": "Passed",
  "evaluations.result.low": "Low result",
  "evaluations.result.incomplete": "Incomplete",
  "evaluations.result.criticalFailure": "Critical safety failure",
  "evaluations.result.saved": "Evaluation recorded.",
  "evaluations.result.sequence": "Completion sequence",
  "evaluations.history.title": "Evaluation history",
  "evaluations.history.attempts": "Retained attempts",
  "evaluations.history.open": "Inspect attempts",
  "evaluations.history.id": "Evaluation",
  "evaluations.history.revision": "Revision",
  "evaluations.history.author": "Author",
  "evaluations.history.recorded": "Recorded",
  "evaluations.history.reason": "Correction or void reason",
  "evaluations.history.voided": "Voided",
  "evaluations.history.raw": "Original observations",
  "evaluations.history.unavailable": "Unavailable in this response",
  "evaluations.history.correction": "Correct or void",
  "evaluations.history.correctionGap":
    "The API does not expose the current global completion sequence required for safe corrections or voids. An administrator must request that interface; history is retained.",
  "evaluations.notice.title": "Human resources notice",
  "evaluations.notice.policies": "Notice configuration versions",
  "evaluations.notice.policyId": "Notice setting",
  "evaluations.notice.recipient": "Recipient",
  "evaluations.notice.noQuadrant": "No applicable quadrant",
  "evaluations.notice.historyHint":
    "Retained versions for this scope and filters. A previous version does not establish that its recipient is still active or that a notice was published or delivered.",
  "evaluations.notice.unconfigured":
    "No recipient configuration is visible for this context and filters. Ask an administrator to configure or review an active recipient membership; notice delivery is unconfirmed.",
  "evaluations.notice.gap":
    "The server retains a cause at the third consecutive adverse result. This contract cannot yet show the receipt or publication and delivery status. Ask an administrator to review configuration and the channel; saving an evaluation does not confirm delivery.",
};
