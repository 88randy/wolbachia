/** Controlled open state of a dialog launched from a row menu. */
export interface DialogControl {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
