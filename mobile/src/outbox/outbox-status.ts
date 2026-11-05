/**
 * The outbox state machine (issue #6). Pure: it decides, the repository writes.
 *
 * ```
 *                 claim                      accept
 *   pending ───────────────▶ sending ───────────────▶ sent
 *      ▲  ▲                    │ │ │
 *      │  └── release/recover ─┘ │ └── reject ──▶ rejected
 *      │  └── failTransient ─────┘     review ──▶ in_review
 *      │                         └── failPermanent ──▶ error
 *      └──────────── retryNow ◀──────────────────────────┘
 * ```
 *
 * Nothing is ever deleted: `sent`, `rejected` and `in_review` are final for the phone (the server
 * decided), and `error` leaves only through `retryNow` (a person pressed "Intentar ahora").
 */

export const OUTBOX_STATUSES = [
  "pending",
  "sending",
  "sent",
  "error",
  "in_review",
  "rejected",
] as const;

export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export type OutboxAction =
  /** A sync pass takes the event to send it. */
  | "claim"
  /** The server stored it (`accepted`). */
  | "accept"
  /** The server refused it (`rejected`). */
  | "reject"
  /** The server stored it for a supervisor (`in_review`). */
  | "review"
  /** The request failed in a way that may pass (no network, 5xx): count the attempt, try later. */
  | "failTransient"
  /** The request cannot succeed as built (malformed envelope): park it until a person retries. */
  | "failPermanent"
  /** The pass stopped for a reason that is not the event's fault (sign-in, throttle): no attempt counted. */
  | "release"
  /** The app was killed while sending: the server may or may not have it; resend (ids make it safe). */
  | "recover"
  /** A person pressed "Intentar ahora" on a parked event. */
  | "retryNow"
  /** A review item pulled from the server says what happened to an event whose answer was lost. */
  | "pulledRejected"
  | "pulledInReview";

export interface OutboxState {
  readonly status: OutboxStatus;
  readonly attempts: number;
}

interface Rule {
  readonly from: readonly OutboxStatus[];
  readonly to: OutboxStatus;
  readonly countsAttempt: boolean;
}

const RULES: Readonly<Record<OutboxAction, Rule>> = {
  claim: { from: ["pending"], to: "sending", countsAttempt: false },
  accept: { from: ["sending"], to: "sent", countsAttempt: false },
  reject: { from: ["sending"], to: "rejected", countsAttempt: false },
  review: { from: ["sending"], to: "in_review", countsAttempt: false },
  failTransient: { from: ["sending"], to: "pending", countsAttempt: true },
  failPermanent: { from: ["sending"], to: "error", countsAttempt: true },
  release: { from: ["sending"], to: "pending", countsAttempt: false },
  recover: { from: ["sending"], to: "pending", countsAttempt: false },
  retryNow: { from: ["error"], to: "pending", countsAttempt: false },
  pulledRejected: { from: ["pending", "sending", "sent"], to: "rejected", countsAttempt: false },
  pulledInReview: { from: ["pending", "sending", "sent"], to: "in_review", countsAttempt: false },
};

/** The state after `action`, or `null` when the action is not allowed from the current status. */
export function applyOutboxAction(state: OutboxState, action: OutboxAction): OutboxState | null {
  const rule = RULES[action];
  if (!rule.from.includes(state.status)) return null;
  return {
    status: rule.to,
    attempts: state.attempts + (rule.countsAttempt ? 1 : 0),
  };
}

/** Statuses a person has to look at (the inbox's "Con problema" section). */
export const PROBLEM_STATUSES: readonly OutboxStatus[] = ["rejected", "in_review", "error"];

/** Statuses of events that are still on the phone and not delivered. */
export const UNSENT_STATUSES: readonly OutboxStatus[] = ["pending", "sending", "error"];

export function isOutboxStatus(value: unknown): value is OutboxStatus {
  return OUTBOX_STATUSES.some((status) => status === value);
}
