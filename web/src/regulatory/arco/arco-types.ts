export const ARCO_TYPES = ["access", "rectification", "cancellation", "opposition"] as const;
export type ArcoType = (typeof ARCO_TYPES)[number];

export const ARCO_STATUSES = ["received", "in_progress", "resolved", "rejected"] as const;
export type ArcoStatus = (typeof ARCO_STATUSES)[number];
