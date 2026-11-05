import { useScopeDimensions } from "./use-scope-dimensions";
import { useState } from "react";
import type { EditTarget } from "./use-scope-editor";
export function useScopeDraft(target: EditTarget) {
  const dimensions = useScopeDimensions(target.record.scope);
  const [permissions, setPermissions] = useState(
    target.kind === "role" ? target.record.permissions : [],
  );
  function toggle(permission: string) {
    setPermissions((previous) =>
      previous.includes(permission)
        ? previous.filter((code) => code !== permission)
        : [...previous, permission].sort(),
    );
  }
  return { ...dimensions, permissions, toggle };
}
