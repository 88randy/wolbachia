import type { lab as esLab } from "../es-MX/lab.ts";
export const lab: Record<keyof typeof esLab, string> = {
  "lab.count.title": "Egg counting",
  "lab.count.value": "Laboratory eggs",
  "lab.count.replacement": "Replacement egg count",
  "lab.count.integer": "Enter a whole number of zero or more, without decimals.",
  "lab.count.save": "Save and next",
  "lab.count.saved": "Count saved.",
  "lab.count.retry": "Retry saving",
  "lab.count.confirm": "Confirm high count",
  "lab.count.confirmHint":
    "The count exceeds the current limit. Confirm it to save and request independent review.",
  "lab.queue.title": "Count queue",
  "lab.queue.bag": "Bag",
  "lab.queue.scan": "Scan or search for a bag code",
  "lab.queue.status": "Status",
  "lab.queue.empty": "No received bags are waiting for an egg count.",
  "lab.shortcuts.title": "Counting keyboard shortcuts",
  "lab.shortcuts.enter": "Enter: save and move to the next bag.",
  "lab.shortcuts.tab": "Tab: next control; Shift + Tab: previous control.",
  "lab.shortcuts.scan": "Scan the code into the bag filter and press Enter; then enter the count.",
  "lab.bag.title": "Bag provenance",
  "lab.bag.block": "Block",
  "lab.bag.date": "Reading date",
  "lab.bag.collector": "Collector (ID)",
  "lab.bag.unavailable": "Unavailable with current permissions",
  "lab.bag.partial":
    "Some source details need additional read permissions. Ask an administrator to review access.",
  "lab.bag.lagged": "Late reading",
  "lab.bag.onTime": "On-time reading",
  "lab.bag.excluded": "Reading excluded from indices; counting is allowed.",
  "lab.history.title": "Egg count history",
  "lab.history.link": "View this bag's count history",
  "lab.history.author": "Counted by (ID)",
  "lab.history.bag": "Bag (ID)",
  "lab.history.time": "Counted at",
  "lab.history.attempt": "Attempt",
  "lab.history.actions": "Actions",
  "lab.history.voided": "Voided",
  "lab.history.recorded": "Recorded",
  "lab.history.retained":
    "The original count is retained. The API does not yet expose the void reason or author in this history.",
  "lab.correction.title": "Correct egg count",
  "lab.correction.hint":
    "The original count is voided and a new observation recorded in one operation. Both remain in history.",
  "lab.correction.reasonCode": "Void reason",
  "lab.correction.reason": "Explanation",
  "lab.correction.noteHint":
    "Choose a reason and enter an explanation of at least 10 visible characters and at most 1000 characters.",
  "lab.correction.catalogPermission":
    "Correction needs access to the void reason catalog. Ask an administrator to review catalog read permission.",
  "lab.correction.catalog": "Could not load void reasons. Retry before saving.",
  "lab.correction.save": "Void and save replacement",
  "lab.draft.restored": "Draft restored.",
  "lab.draft.discard": "Discard draft",
  "lab.error.uncertain":
    "Saving was not confirmed. Your value is retained: retry the same save before changing it.",
  "lab.error.conflict":
    "Another capture changed this bag. Your value is retained; review the history before continuing.",
  "lab.error.conflictHidden":
    "You cannot read who recorded the count. Ask an administrator to review history access.",
  "lab.error.conflictMissing":
    "No current count is visible. The bag may have been voided or rejected; refresh the queue.",
  "lab.error.rejected": "Could not save. Review the values or your permissions, then try again.",
};
