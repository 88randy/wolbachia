/** Public API of the void-with-reason pattern (#32). Screens import from here only. */
export { VoidDialog } from "./VoidDialog";
export type { VoidDialogProps } from "./VoidDialog";
export { submitVoid } from "./submit-void";
export type { VoidResult } from "./submit-void";
export { useVoidLimits } from "./use-void-limits";
export { voidFailureKey, voidFailureOf } from "./void-failure";
export type { VoidFailure } from "./void-failure";
export { voidInfoOf } from "./void-info";
export type { VoidFields, VoidInfo } from "./void-info";
export { DEFAULT_VOID_LIMITS } from "./void-limits";
export type { VoidLimits } from "./void-limits";

export type { VoidChoice } from "./use-void-form";
