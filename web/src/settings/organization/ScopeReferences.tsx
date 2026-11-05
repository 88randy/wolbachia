import type { Schemas } from "@wolbachia/api-client";
import { ScopeReference } from "./ScopeReference";
interface Props {
  dimension: "centers" | "quadrants";
  value: Schemas["ScopeDimension"];
  onChange: (value: Schemas["ScopeDimension"]) => void;
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
            onChange({ ...value, ids: value.ids.filter((item) => item !== identifier) });
          }}
        />
      ))}
    </ul>
  );
}
