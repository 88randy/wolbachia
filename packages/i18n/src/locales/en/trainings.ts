import type { trainings as Spanish } from "../es-MX/trainings";
export const trainings: Record<keyof typeof Spanish, string> = {
  "trainings.workspace.title": "Trainings",
  "trainings.workspace.evaluations": "Evaluation sheets",
  "trainings.workspace.denied":
    "You do not have training access in this scope. Ask Administration for the permission and scope.",
  "trainings.field.code": "Course code",
  "trainings.field.name": "Course name",
  "trainings.field.validity": "Validity (seconds)",
  "trainings.field.noneOption": "No quadrant",
  "trainings.field.pickPlaceholder": "Choose from the list",
  "trainings.field.otherAction": "Other action (specify)",
  "trainings.field.pickCourseFirst": "Choose the course first.",
  "trainings.field.versionOption": "Version {version}",
  "trainings.action.release.record": "Record releases",
  "trainings.field.actions": "Enabled actions",
  "trainings.field.actionsHint":
    "Configured action keys, separated by commas. Publishing a course does not assign permissions.",
  "trainings.field.effective": "Effective from",
  "trainings.field.instantHint":
    "Date and time with an explicit zone, for example 2026-11-09T12:00:00-06:00.",
  "trainings.field.center": "Center",
  "trainings.field.quadrant": "Quadrant (optional)",
  "trainings.field.subject": "Person",
  "trainings.field.action": "Action key",
  "trainings.field.at": "Query instant (optional)",
  "trainings.field.trainingVersion": "Course version",
  "trainings.field.requirementVersion": "Requirement version",
  "trainings.field.validFrom": "Inclusive start",
  "trainings.field.validTo": "Exclusive end",
  "trainings.field.expiryHint":
    "The certification expires exactly at this instant; include its time zone.",
  "trainings.field.evidence": "Verified evidence",
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
  "trainings.field.certificate": "Certificate",
  "trainings.field.revoked": "Revoked from",
  "trainings.field.nextChange": "Next eligibility change",
  "trainings.field.training": "Course",
  "trainings.field.acceptableVersions": "Accepted versions",
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
  "trainings.person.lookupHint": "Choose the person and the center to see their trainings.",
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
  "trainings.form.saved": "Record saved.",
  "trainings.form.review": "I reviewed history; allow another attempt",
  "trainings.form.reviewHint":
    "No record will be sent automatically. Review history and confirm before saving again.",
  "trainings.eligibility.refreshRequired":
    "A validity boundary was reached. Refresh to confirm eligibility with the server.",
  "trainings.mobile.title": "Trainings and evaluations",
  "trainings.mobile.qualification": "Downloaded qualification by action",
  "trainings.mobile.certificates": "Downloaded certificates",
  "trainings.mobile.evaluations": "Evaluation sheets",
  "trainings.mobile.eligible": "Current training",
  "trainings.mobile.blocked": "Training needed",
  "trainings.mobile.expired": "Expired",
  "trainings.mobile.unavailable":
    "Sync to review your training. Eligibility cannot be confirmed without current data.",
  "trainings.mobile.boundary":
    "Training does not qualify this action. Ask your supervisor to check your validity and training schedule.",
  "trainings.mobile.qualificationHint":
    "Training is one requirement. Permissions and other capture conditions are checked separately.",
  "trainings.mobile.validUntil": "Valid until",
  "trainings.mobile.validFrom": "Valid from",
  "trainings.mobile.revoked": "Revoked",
  "trainings.mobile.future": "Not yet valid",
  "trainings.mobile.valid": "Current",
  "trainings.mobile.pass": "Correct",
  "trainings.mobile.low": "Observation to improve",
  "trainings.mobile.critical": "Training required",
  "trainings.mobile.incomplete": "Incomplete evaluation",
  "trainings.mobile.voided": "Voided; original retained",
  "trainings.mobile.refresh": "Refresh with signal",
  "trainings.mobile.refreshing": "Refreshing; downloaded information is retained.",
  "trainings.mobile.failed":
    "Could not refresh. Downloads are retained; find signal and try again.",
  "trainings.mobile.localFailed":
    "Could not read the phone's information. Try again; records and drafts are retained.",
  "trainings.mobile.empty":
    "No records in this download. Refresh with signal to check for changes.",
  "trainings.mobile.notDownloaded":
    "Certificates or evaluation sheets have not been downloaded yet. Refresh with signal.",
  "trainings.mobile.privateDenied":
    "Private evaluations require authorization. Ask your supervisor to check your access.",
  "trainings.mobile.trainingDenied":
    "Certificates require authorization. Ask your supervisor to check your access.",
  "trainings.mobile.partial":
    "Showing the first authorized records. More history may exist; ask your supervisor.",
  "trainings.mobile.downloadedAt": "Certificates and evaluations downloaded",
  "trainings.mobile.author": "Author",
  "trainings.mobile.reason": "Reason or observation",
  "trainings.mobile.revision": "Revision",
  "trainings.mobile.source": "Original record",
  "trainings.mobile.context": "Center and quadrant",
  "trainings.state.configured": "Configured",
  "trainings.facts.certificateCount": "Certificates: {count}",
};
