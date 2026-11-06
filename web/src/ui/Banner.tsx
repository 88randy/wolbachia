import type { ComponentProps } from "react";
import { InlineNotice } from "./InlineNotice";
export function Banner(props: ComponentProps<typeof InlineNotice>) {
  return <InlineNotice {...props} />;
}
