import type { Schemas } from "@wolbachia/api-client";
export type ScopeDimensionName = keyof Schemas["MeScope"];
export type ScopeDimensionUpdate = (
  current: Schemas["ScopeDimension"],
) => Schemas["ScopeDimension"];
export type ScopeDimensionChange = (update: ScopeDimensionUpdate) => void;
export type BeginScopeLookup = () => () => void;
export interface ScopeDimensionEditor {
  value: Schemas["ScopeDimension"];
  readonly intentRevision: number;
  change: ScopeDimensionChange;
  applyLookup: (expectedIntent: number, id: string) => void;
}

export type ScopeLookupIntent = Pick<ScopeDimensionEditor, "intentRevision" | "applyLookup">;
