import { captureLocalDate } from "../day/capture-local-date.ts";
import type { ReleaseProjectionSource } from "./projections.ts";
import type {
  ReleaseCustody,
  ReleaseDraft,
  ReleasePins,
  ReleaseSelection,
  ReleaseTask,
} from "./types.ts";
import { quantityUnits, quantityText } from "./domain.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";

interface SelectionInput {
  readonly source: ReleaseProjectionSource;
  readonly selection: ReleaseSelection;
  readonly shiftId: string;
  readonly timezone: string;
  readonly deviceTime: string;
}
interface Candidate {
  readonly permit: ReleasePins["permit"];
  readonly task: ReleaseTask;
}
function taskCandidates(input: SelectionInput): Candidate[] {
  return input.source.permits.flatMap((permit) =>
    (permit.capture?.tasks ?? []).flatMap((task) => {
      const assignment = input.source.tasks.find(({ id }) => id === task.id);
      const matches =
        assignment &&
        assignment.quadrant_id === permit.quadrant_id &&
        assignment.courier === task.courier_id &&
        assignment.date === task.due_date &&
        task.courier_id === input.source.handle.owner.userId &&
        task.permit_id === permit.id &&
        task.permit_version_id === permit.permit_version_id;
      return matches ? [{ permit, task }] : [];
    }),
  );
}
function unique<Result extends { readonly id: string }>(rows: readonly Result[]): Result[] {
  return rows.filter((row, index) => rows.findIndex(({ id }) => id === row.id) === index);
}
/** Only authentic downloaded task bindings connect a device to a release capture. */
export function releaseChoices(input: SelectionInput) {
  const candidates = taskCandidates(input);
  const tasks = unique(
    candidates
      .filter(
        ({ permit }) =>
          !input.selection.deviceId ||
          permit.capture?.devices.some(({ id }) => id === input.selection.deviceId),
      )
      .map(({ task }) => ({
        id: task.id,
        code: input.source.tasks.find(({ id }) => id === task.id)?.code ?? task.id,
      })),
  );
  const devices = unique(
    candidates
      .filter(({ task }) => !input.selection.taskId || task.id === input.selection.taskId)
      .flatMap(({ permit }) => permit.capture?.devices.map(({ id, code }) => ({ id, code })) ?? []),
  );
  return { tasks, devices };
}
function receiptMatches(custody: ReleaseCustody, input: SelectionInput): boolean {
  return (
    Date.parse(custody.received_at) <= Date.parse(input.deviceTime) &&
    (custody.shift_id === input.shiftId ||
      (custody.shift_id === null &&
        custody.assignment_date === captureLocalDate(input.deviceTime, input.timezone)))
  );
}
export function resolveReleasePins(input: SelectionInput): ReleasePins | null {
  const matches = taskCandidates(input).filter(
    ({ task, permit }) =>
      task.id === input.selection.taskId &&
      permit.capture?.devices.some(({ id }) => id === input.selection.deviceId),
  );
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (!match) return null;
  const device = match.permit.capture?.devices.find(({ id }) => id === input.selection.deviceId);
  const custody = device?.custody.find((row) => receiptMatches(row, input));
  const qualifications = input.source.eligibility.filter(
    (row) =>
      row.action === "release.record" &&
      row.center_id === match.permit.center_id &&
      row.quadrant_id === match.permit.quadrant_id,
  );
  const eligibility = qualifications.length === 1 ? qualifications[0] : undefined;
  if (!device || !custody || !eligibility || !match.permit.capture) return null;
  return { ...match, device, custody, eligibility, captureVersion: match.permit.capture.version };
}
export interface ReservationEntry {
  readonly draft: ReleaseDraft;
  readonly event: OutboxEvent;
}
function isReserved(entry: ReservationEntry, settledIds: readonly string[]): boolean {
  return !settledIds.includes(entry.draft.eventId);
}
function availableFor(
  custody: ReleaseCustody,
  input: { entries: readonly ReservationEntry[]; settledIds: readonly string[]; exclude: string },
) {
  let available = quantityUnits(custody.available_quantity) ?? 0n;
  for (const entry of input.entries) {
    const line = entry.draft.assessment?.receiptLineId ?? entry.draft.pins.custody.receipt_line_id;
    if (
      entry.draft.eventId !== input.exclude &&
      line === custody.receipt_line_id &&
      isReserved(entry, input.settledIds)
    )
      available -= quantityUnits(entry.draft.quantity) ?? 0n;
  }
  return available > 0n ? available : 0n;
}
function matchesReceiptTime(row: ReleaseCustody, draft: ReleaseDraft): boolean {
  return (
    Date.parse(row.received_at) <= Date.parse(draft.deviceTime) &&
    (row.shift_id === draft.shiftId ||
      (row.shift_id === null &&
        row.assignment_date === captureLocalDate(draft.deviceTime, draft.timezone)))
  );
}
/** Mirror the server's first sufficient receipt order; never skip an unsafe sufficient source. */
export function releaseCustody(input: {
  readonly draft: ReleaseDraft;
  readonly current: ReleasePins | null;
  readonly entries: readonly ReservationEntry[];
  readonly discardedIds?: readonly string[];
}) {
  const requested = quantityUnits(input.draft.quantity) ?? 0n;
  const available = (row: ReleaseCustody) =>
    availableFor(row, {
      entries: input.entries,
      settledIds: [...row.accounted_release_event_ids, ...(input.discardedIds ?? [])],
      exclude: input.draft.eventId,
    });
  const current = input.current?.device.custody.find(
    (row) => available(row) >= requested && matchesReceiptTime(row, input.draft),
  );
  const original = input.draft.pins.device.custody.find(
    ({ receipt_line_id }) => receipt_line_id === current?.receipt_line_id,
  );
  return {
    draft: original
      ? { ...input.draft, pins: { ...input.draft.pins, custody: original } }
      : input.draft,
    current: current && input.current && original ? { ...input.current, custody: current } : null,
    availableQuantity: current ? quantityText(available(current)) : "0.000000",
  };
}
