import type { trainings as Spanish } from "../es-MX/trainings";
export const trainings: Record<keyof typeof Spanish, string> = {
  "trainings.workspace.title": "Trainings",
  "trainings.workspace.evaluations": "Evaluation sheets",
  "trainings.workspace.denied":
    "You do not have training access in this scope. Ask Administration for the permission and scope.",
  "trainings.field.code": "Course code",
  "trainings.field.name": "Course name",
  "trainings.field.validity": "Validity (seconds)",
  "trainings.field.actions": "Enabled actions",
  "trainings.field.actionsHint":
    "Configured action keys, separated by commas. Publishing a course does not assign permissions.",
  "trainings.field.effective": "Effective from",
  "trainings.field.instantHint":
    "Date and time with an explicit zone, for example 2026-11-09T12:00:00-06:00.",
  "trainings.field.center": "Center UUID",
  "trainings.field.quadrant": "Quadrant UUID (optional when allowed by scope)",
  "trainings.field.subject": "Person UUID",
  "trainings.field.action": "Action key",
  "trainings.field.at": "Query instant (optional)",
  "trainings.field.trainingVersion": "Course version (UUID)",
  "trainings.field.requirementVersion": "Requirement version",
  "trainings.field.validFrom": "Inclusive start",
  "trainings.field.validTo": "Exclusive end",
  "trainings.field.expiryHint":
    "The certification expires exactly at this instant; include its time zone.",
  "trainings.field.evidence": "Verified evidence UUIDs",
  "trainings.field.evidenceHint":
    "Only your verified unbound uploads, separated by commas. You can upload and verify an image above.",
  "trainings.evidence.file": "Certification image",
  "trainings.evidence.hint":
    "PNG or JPEG up to 10 MB. The image is verified before it is linked to the record.",
  "trainings.evidence.upload": "Upload and verify image",
  "trainings.evidence.invalid": "Choose a valid PNG or JPEG image up to 10 MB.",
  "trainings.evidence.failed":
    "The image was not confirmed. Your file was retained; upload it again to renew or verify receipt.",
  "trainings.evidence.verified":
    "Image verified by the server. It will be linked when the certification is recorded.",
  "trainings.field.issuer": "Issuer reference",
  "trainings.field.attestation": "Certification attestation",
  "trainings.field.status": "Status",
  "trainings.field.certificate": "Certification (UUID)",
  "trainings.field.revoked": "Revoked from",
  "trainings.field.nextChange": "Next eligibility change",
  "trainings.field.training": "Course (UUID)",
  "trainings.field.acceptableVersions": "Acceptable versions (comma-separated UUIDs)",
  "trainings.requirement.title": "Requirements by action and context",
  "trainings.requirement.inspect": "Inspect context requirements",
  "trainings.requirement.publish": "Publish action requirement",
  "trainings.requirement.publishHint":
    "Publish a permanent version accepting the listed versions of this course. Other courses required by the selected policy are retained; existing requirements cannot be removed here. A new action starts at revision zero; the server rejects an outdated revision.",
  "trainings.state.active": "Active",
  "trainings.state.inactive": "Inactive",
  "trainings.state.notRevoked": "No recorded revocation",
  "trainings.state.unconfigured": "Unconfigured",
  "trainings.state.unavailable": "Unavailable",
  "trainings.course.open": "View course",
  "trainings.course.create": "New course",
  "trainings.course.createHint":
    "Create the course identity, then publish its validity and enabled actions.",
  "trainings.course.publish": "Publish version",
  "trainings.course.publishHint":
    "The new version is permanent. It retains older versions and does not change recorded certifications. Cancel to review before publishing.",
  "trainings.course.versions": "Course versions",
  "trainings.course.unavailable":
    "The record is unavailable in your scope. Check the reference or request access from Administration.",
  "trainings.person.title": "Certifications by person",
  "trainings.person.lookupHint":
    "Use authorized person and context references. Training access does not grant personnel directory search or private evaluation access.",
  "trainings.person.inspect": "Inspect certifications and eligibility",
  "trainings.person.certificates": "Certification history",
  "trainings.person.create": "Record certification",
  "trainings.person.createHint":
    "Record verified evidence and an explicit validity interval for this person and context. The server validates references and the course maximum validity.",
  "trainings.person.uploadPermission":
    "Recording a certification also needs evidence linking permission. Administration can grant it.",
  "trainings.eligibility.title": "Training eligibility",
  "trainings.eligibility.eligible": "Training valid",
  "trainings.eligibility.blocked": "Action blocked by training",
  "trainings.eligibility.factual":
    "Server factual result for the requested action, context and instant. It does not grant permission to perform the action.",
  "trainings.eligibility.unblocker":
    "Administration must review requirements, configuration and certification before enabling the action.",
  "trainings.eligibility.requirementsMissing":
    "Training requirements are unconfigured for this context.",
  "trainings.eligibility.configurationMissing":
    "The required training version is unavailable or unconfigured.",
  "trainings.eligibility.certificateExpired":
    "The required certification is missing, expired or does not cover the requested instant.",
  "trainings.eligibility.unavailable":
    "Required training could not be established. Ask Administration to review it.",
  "trainings.form.invalidField": "Complete this field with a valid reference or value.",
  "trainings.form.invalid": "Review the indicated fields.",
  "trainings.form.invalidHint":
    "Your input was retained. Dates need a time zone and references must be valid UUIDs.",
  "trainings.form.failed":
    "The record could not be confirmed. Your input was retained; check history before trying again.",
  "trainings.form.saved": "Record confirmed by the server.",
  "trainings.form.review": "I reviewed history; allow another attempt",
  "trainings.form.reviewHint":
    "No record will be sent automatically. Review history and confirm before saving again.",
  "trainings.eligibility.refreshRequired":
    "A validity boundary was reached. Refresh to confirm eligibility with the server.",
};
