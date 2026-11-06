import type { Draft } from "./types.ts";
import type { M08Model } from "./use-m-08.ts";
export interface CaptureProps {
  readonly model: M08Model;
  readonly draft: Draft;
}
