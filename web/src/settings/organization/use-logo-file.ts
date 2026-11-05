import { useState } from "react";
import type { ChangeEvent } from "react";
import { isAllowedLogo } from "./branding";
export function useLogoFile() {
  const [file, setFile] = useState<File | null>(null);
  const [isInvalid, setInvalid] = useState(false);
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    setInvalid(selected !== undefined && !isAllowedLogo(selected));
    setFile(selected && isAllowedLogo(selected) ? selected : null);
  }
  return { file, isInvalid, choose };
}
