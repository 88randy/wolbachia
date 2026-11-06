import type { DialogFrameProps } from "./DialogFrame";
import { DialogFrame } from "./DialogFrame";
export function Dialog(props: Omit<DialogFrameProps, "isSheet">) {
  return <DialogFrame {...props} />;
}
