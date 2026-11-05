import { useState } from "react";
/** Create drafts exist only while their dialog is open. */
export function useListDialog() {
  const [isAdding, setAdding] = useState(false);
  const [isSaved, setSaved] = useState(false);
  return {
    isAdding,
    isSaved,
    open: () => {
      setAdding(true);
    },
    close: () => {
      setAdding(false);
    },
    created: () => {
      setAdding(false);
      setSaved(true);
    },
  };
}
