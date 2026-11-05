import { createContext } from "react";
import type { RefObject } from "react";
import type { Schemas } from "@wolbachia/api-client";
import type { ResolutionDraft } from "./geometry";
export interface RetainedDraft {
  record: Pick<Schemas["Quadrant"], "id" | "center">;
  text: string;
  revision: number;
  resolutions: Record<string, ResolutionDraft>;
}
export const DraftMemory = createContext<RefObject<RetainedDraft | null>>({ current: null });
