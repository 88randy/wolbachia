import { useState } from "react";
import type { EditTarget } from "./use-scope-editor";
export function useScopeDraft(target: EditTarget) {
  const [scope, setScope] = useState(target.record.scope);
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
  return { scope, setScope, permissions, toggle };
}
