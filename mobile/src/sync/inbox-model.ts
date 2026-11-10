import type { MessageKey } from "@wolbachia/i18n";

import { isMessageKey } from "../i18n/translate.ts";
import type { EventResult, ProblemItem, TypeGroup } from "../outbox/outbox-event.ts";
import type { OutboxStatus } from "../outbox/outbox-status.ts";

/** `"void_target_not_found"` becomes `"voidTargetNotFound"` (the key convention of `packages/i18n`). */
export function snakeToCamel(code: string): string {
  return code.replace(/[._]([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

/** Label key for an event type such as `ovitrap.check`; unknown types fall back to "Other records". */
export function eventTypeKey(type: string): MessageKey {
  const key = `mobile.eventType.${snakeToCamel(type)}`;
  return isMessageKey(key) ? key : "mobile.eventType.unknown";
}

/** Badge text for each status. Sent, rejected and in review reuse the shared sync keys. */
export const STATUS_BADGE_KEY: Readonly<Record<OutboxStatus, MessageKey>> = {
  pending: "mobile.status.pending",
  sending: "mobile.status.sending",
  sent: "sync.inbox.acceptedTitle",
  error: "mobile.status.error",
  in_review: "sync.inbox.inReviewTitle",
  rejected: "sync.inbox.rejectedTitle",
};

const FALLBACK_HINT_KEY: Readonly<Partial<Record<OutboxStatus, MessageKey>>> = {
  rejected: "sync.inbox.rejectedHint",
  in_review: "sync.inbox.inReviewHint",
  error: "mobile.inbox.parkedHint",
};

export function resultMessageKey(result: EventResult | null): MessageKey | null {
  if (result === null) return null;
  const key = `sync.result.${snakeToCamel(result.code)}`;
  return isMessageKey(key) ? key : null;
}

/**
 * The plain-language explanation of a problem: the message of the server's code when this app
 * knows it, otherwise the generic hint of the status. Never the raw code.
 */
export function problemMessageKey(item: ProblemItem): MessageKey {
  return (
    resultMessageKey(item.result) ?? FALLBACK_HINT_KEY[item.status] ?? "sync.inbox.rejectedHint"
  );
}

/** The inbox sections, ready to render. */
export interface InboxModel {
  readonly problems: readonly ProblemItem[];
  readonly onPhone: readonly TypeGroup[];
  readonly sent: readonly TypeGroup[];
  readonly onPhoneTotal: number;
  readonly sentTotal: number;
}

function total(groups: readonly TypeGroup[]): number {
  return groups.reduce((sum, group) => sum + group.total, 0);
}

/**
 * Builds the inbox from the repository's queries. `onPhoneGroups` holds the `pending` and `sending`
 * events; parked (`error`) events are listed with the problems, never hidden in a count.
 */
export function buildInboxModel(
  problems: readonly ProblemItem[],
  onPhoneGroups: readonly TypeGroup[],
  sentGroups: readonly TypeGroup[],
): InboxModel {
  return {
    problems,
    onPhone: onPhoneGroups,
    sent: sentGroups,
    onPhoneTotal: total(onPhoneGroups),
    sentTotal: total(sentGroups),
  };
}
