/**
 * English catalog. It must define exactly the keys of `es-MX.ts`:
 * a missing or extra key fails `tsc`.
 */
import type { MessageKey } from './es-MX.ts';

export const en: Record<MessageKey, string> = {
  // Common actions
  'common.actions.save': 'Save',
  'common.actions.cancel': 'Cancel',
  'common.actions.retry': 'Try again',
  'common.actions.close': 'Close',
  'common.actions.void': 'Void',

  // Common fields
  'common.fields.voidReason': 'Reason for voiding',
  'common.fields.otherSpecify': 'Other (specify)',

  // API errors: the API returns `code` + `params`, never text
  'errors.api.generic': "We couldn't complete the action. Please try again.",
  'errors.api.network': "We can't reach the server. Check your signal and try again.",
  'errors.api.validation': 'Some data is not valid. Review the highlighted fields and fix them.',
  'errors.api.notFound': "We couldn't find what you're looking for. Go back and try again.",
  'errors.api.permissionDenied': "You don't have permission to do this. Ask your supervisor for access.",
  'errors.api.blocked': 'This action is blocked for now. Let {role} know so they can unblock it.',
  'errors.api.sessionRevoked': 'Your session ended. Sign in again to continue.',
  'errors.api.rateLimited': 'Too many requests in a row. Wait {seconds} seconds and try again.',
  'errors.api.serverError': 'Something went wrong on our side. Try again in a few minutes; if it keeps happening, contact support.',

  // Result of sending a record to the server (phone inbox)
  'sync.inbox.acceptedTitle': 'Sent',
  'sync.inbox.acceptedHint': 'The server received this record. You have nothing else to do.',
  'sync.inbox.rejectedTitle': 'Not accepted',
  'sync.inbox.rejectedHint': "The server couldn't accept this record. Ask your supervisor to review it.",
  'sync.inbox.inReviewTitle': 'In review',
  'sync.inbox.inReviewHint': "A supervisor will review this record. You don't need to do anything meanwhile.",
};
