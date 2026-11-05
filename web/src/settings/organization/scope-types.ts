import type { Schemas } from "@wolbachia/api-client";
export type ScopeDimensionChange = (
  update: (current: Schemas["ScopeDimension"]) => Schemas["ScopeDimension"],
) => void;
export type BeginScopeLookup = () => () => void;
