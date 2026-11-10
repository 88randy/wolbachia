/** English messages of the `table` area: exactly the keys of `../es-MX/table.ts`. */
import type { table as source } from "../es-MX/table.ts";

export const table: Record<keyof typeof source, string> = {
  // Sorting. `{column}` is the already translated header of the column.
  "table.sort.ascending": "Sorted by {column}, ascending",
  "table.sort.descending": "Sorted by {column}, descending",

  // Result count and loading, announced to screen readers
  "table.status.range": "{from}–{to} of {total}",
  "table.status.rangeCursor": "Results on this page: {count}",
  "table.status.loading": "Loading results",

  // Paging
  "table.pager.label": "Pagination",
  "table.pager.previous": "Previous",
  "table.pager.next": "Next",
  "table.pager.position": "Page {page} of {pages}",
  "table.pager.first": "Go to the first page",

  // Filter bar
  "table.filters.label": "Filters",
  "table.filters.active": "Active filters",
  "table.filters.all": "All",
  "table.filters.apply": "Apply",
  "table.filters.clear": "Clear filters",
  "table.filters.remove": "Remove filter {filter}: {value}",
  "table.filters.includeVoided": "Include voided",
  "table.filters.button": "Filters",
  "table.filters.search": "Search",
  "table.filters.searchPlaceholder": "Search…",
  "table.filters.dates": "Dates",
  "table.filters.anyDate": "Any date",
  "table.filters.dateFrom": "From {date}",
  "table.filters.dateTo": "Until {date}",
  "table.filters.applied": "applied",
  "table.filters.default": "{value} (default)",
  "table.filters.info": "More information",
  "table.filters.quick": "Quick filter",
  "table.filters.clearDates": "Clear dates",
  "table.filters.ignoredTitle": "We ignored part of the address",
  "table.filters.ignoredBody":
    "These parameters are not valid for this list and were not applied: {names}.",
  "table.filters.ignoredMore": "and {count} more",
  "table.filters.ignoredDismiss": "Remove from the address",

  // Empty state
  "table.empty.title": "There are no records here yet",
  "table.empty.filteredTitle": "No results with these filters",
  "table.empty.filteredBody": "Try other filters, or clear them to see everything.",

  // Row selection
  "table.selection.all": "Select all rows on this page",
  "table.selection.row": "Select {row}",
  "table.selection.count": "Selected: {count}",
  "table.selection.clear": "Clear selection",

  // Voided rows
  "table.voided.badge": "Voided",
  "table.voided.reason": "Reason: {reason}",
  "table.voided.author": "Voided by: {author}",
  "table.voided.when": "Date: {when}",

  // Export (the file is built by the backend)
  "table.export.button": "Export",
  "table.export.pending": "Preparing the export",
  "table.export.done": "The export was downloaded.",
};
