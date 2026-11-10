import { ReleaseView } from "./ReleaseView.tsx";
import { useM10 } from "./use-m-10.ts";
import type { ReleaseSelection } from "./types.ts";

/** P18 routes to the same non-overridable P19 prerequisite view when any fact is unavailable. */
export function P18Screen({ selection }: { readonly selection: ReleaseSelection }) {
  return <ReleaseView model={useM10(selection)} />;
}
