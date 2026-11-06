import type { ScopeDimensionChange } from "./scope-types";
import type { Schemas } from "@wolbachia/api-client";
import { ScopeReference } from "./ScopeReference";
interface Props {
  dimension: "centers" | "quadrants";
  value: Schemas["ScopeDimension"];
  onChange: ScopeDimensionChange;
}
export function ScopeReferences({ dimension, value, onChange }: Props) {
  return (
    <ul>
      {value.ids.map((identifier) => (
        <ScopeReference
          key={identifier}
          id={identifier}
          dimension={dimension}
          onRemove={() => {
            onChange((current) => ({
              ...current,
              ids: current.ids.filter((item) => item !== identifier),
            }));
          }}
        />
      ))}
    </ul>
  );
}
