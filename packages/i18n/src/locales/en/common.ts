/** English messages of the `common` area: exactly the keys of `../es-MX/common.ts`. */
import type { common as source } from "../es-MX/common.ts";

export const common: Record<keyof typeof source, string> = {
  // Common actions
  "common.actions.save": "Save",
  "common.actions.cancel": "Cancel",
  "common.actions.retry": "Try again",
  "common.file.choose": "Choose file",
  "common.file.none": "No file selected",
  "common.actions.close": "Close",
  "common.actions.goHome": "Go to home",
  "common.actions.void": "Void",

  "common.actions.more": "More options",
  "common.actions.morePages": "More pages",
  "common.actions.search": "Search",
  "common.actions.open": "Open",
  "common.actions.back": "Back",
  "common.actions.next": "Next",
  "common.actions.previous": "Previous",
  "common.actions.finish": "Done",
  "common.actions.rowActions": "Row actions",
  "common.wizard.step": "Step {current} of {total}",
  "common.pending.title": "Your pending work",
  "common.pending.empty": "Nothing pending. Nice work!",
  "common.table.searchPlaceholder": "Search…",
  "common.table.pageOf": "Page {page} of {pages}",
  "common.table.rows": "{count} records",
  "common.table.empty": "No records yet",
  "common.table.noResults": "No records match the filters",
  "common.table.clearFilters": "Clear filters",
  "common.table.loading": "Loading records",

  // Common fields
  "common.fields.voidReason": "Reason for voiding",
  "common.fields.otherSpecify": "Other (specify)",
};
