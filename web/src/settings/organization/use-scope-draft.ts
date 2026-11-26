import { useScopeDimensions } from "./use-scope-dimensions";
import { useState } from "react";
import type { EditTarget } from "./use-scope-editor";
export function useScopeDraft(target: EditTarget) {
  const dimensions = useScopeDimensions(target.record.scope);
  const [permissions, setPermissions] = useState(
    target.kind === "role" ? target.record.permissions : [],
  );
  const [profiles, setProfiles] = useState(
    target.kind === "membership" ? target.record.profiles : [],
  );
  function toggleProfile(id: string) {
    setProfiles((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
    );
  }
  function toggle(permission: string) {
    setPermissions((previous) =>
      previous.includes(permission)
        ? previous.filter((code) => code !== permission)
        : [...previous, permission].sort(),
    );
  }
  return { ...dimensions, permissions, toggle, profiles, toggleProfile };
}
