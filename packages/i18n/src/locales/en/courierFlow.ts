/** English messages of the secondary courier flows (release, samples, fuel, problems, community). */
import type { AreaCatalog } from "../area.ts";
import type { courierFlow as source } from "../es-MX/courierFlow.ts";

export const courierFlow = {
  "courier.flow.release.subtitle": "Release mosquitoes",
  "courier.flow.release.gatesTitle": "What we already checked",
  "courier.flow.release.gateOk": "Ready",
  "courier.flow.release.gateFail": "Not met",
  "courier.flow.release.gateUnknown": "Missing information",
  "courier.flow.release.blockedTitle": "You cannot release yet",
  "courier.flow.release.blockedBody":
    "Something is missing. Below you see what it is and who can fix it. Tell your supervisor.",
  "courier.flow.release.sachets": "Sachets to release",
  "courier.flow.release.photoTitle": "Release photo",
  "courier.flow.release.done": "Done",
  "courier.flow.sample.subtitle": "Collect a sample",
  "courier.flow.sample.done": "Done",
  "courier.flow.fuel.subtitle": "Fuel refill",
  "courier.flow.fuel.begin": "Record a refill",
  "courier.flow.fuel.done": "Done",
  "courier.flow.incident.subtitle": "What happened?",
  "courier.flow.incident.whatHappened": "Choose what happened",
  "courier.flow.incident.send": "Send report",
  "courier.flow.training.certificate": "Training",
  "courier.flow.training.evaluation": "Evaluation",
  "courier.flow.community.tile": "Community activity",
  "courier.flow.community.title": "Community activity",
  "courier.flow.community.subtitle": "Record a talk or visit",
  "courier.flow.community.typeTitle": "What did you do?",
  "courier.flow.community.noTypes": "There are no activity types yet. Tell your supervisor.",
  "courier.flow.community.otherLabel": "Which other activity?",
  "courier.flow.community.zoneTitle": "Which block?",
  "courier.flow.community.noZones": "You have no blocks assigned to record activities.",
  "courier.flow.community.attendance": "People who attended",
  "courier.flow.community.agreementsTitle": "Agreements (optional)",
  "courier.flow.community.privacyHint": "Do not write names or personal details.",
  "courier.flow.community.send": "Record activity",
  "courier.flow.community.needsSignal":
    "You need signal to record an activity. Connect and try again.",
  "courier.flow.community.sendFailed":
    "It could not be recorded. Your data is still here; try again with signal.",
  "courier.flow.community.doneTitle": "Activity recorded",
  "courier.flow.community.doneBody": "The office already received it. Good work.",
  "courier.flow.community.back": "Back to my day",
  "courier.flow.community.another": "Record another",
} as const satisfies AreaCatalog<"courier"> & Record<keyof typeof source, string>;
