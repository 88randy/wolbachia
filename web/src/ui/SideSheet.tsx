import type { DialogFrameProps } from "./DialogFrame";
import { DialogFrame } from "./DialogFrame";
export function SideSheet(props: Omit<DialogFrameProps, "isSheet">) {
  return <DialogFrame {...props} isSheet />;
}
