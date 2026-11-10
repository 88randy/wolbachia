import { useState } from "react";
import { readLabStored, writeLabStored } from "./lab-storage";
/** Session draft ownership is user + organization + target + field. */
export function useLabText(key: string) {
  const [text, setText] = useState(() => readLabStored(key) ?? "");
  return [
    text,
    (value: string) => {
      writeLabStored(key, value);
      setText(value);
    },
  ] as const;
}
