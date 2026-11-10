import { SampleView } from "./SampleView.tsx";
import { useSamples } from "./use-samples.ts";
import type { SampleSelection } from "./types.ts";

export function P20Screen({ selection }: { readonly selection: SampleSelection }) {
  return <SampleView model={useSamples(selection)} />;
}
