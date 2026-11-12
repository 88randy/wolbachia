import { useState } from "react";
import { DEFAULT_COPIES } from "./label-formats";
import type { LabelFormat } from "./label-formats";
import { readLabelPreferences, saveLabelPreferences } from "./label-preferences";
import { parseCopies, planLabels } from "./plan-labels";
import type { LabelRecord } from "./label-record";

/** The format and copies chosen in the dialog (remembered per browser) and the resulting labels. */
export function useLabelOptions(records: readonly LabelRecord[]) {
  const [initial] = useState(readLabelPreferences);
  const [format, setFormat] = useState<LabelFormat>(initial.format);
  const [copiesText, setCopiesText] = useState(String(initial.copies));
  const copies = copiesText === "" ? DEFAULT_COPIES : parseCopies(copiesText);
  const plan = planLabels(records, copies);
  const chooseFormat = (next: LabelFormat) => {
    setFormat(next);
    saveLabelPreferences({ format: next, copies });
  };
  const changeCopies = (text: string) => {
    setCopiesText(text);
    saveLabelPreferences({ format, copies: text === "" ? DEFAULT_COPIES : parseCopies(text) });
  };
  return { format, chooseFormat, copiesText, changeCopies, copies, plan };
}
