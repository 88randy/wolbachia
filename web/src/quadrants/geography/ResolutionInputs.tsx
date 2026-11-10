import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { EVIDENCE_MAX_LENGTH, parseLocation } from "./geometry";
import { MapPointPicker } from "../../map-picker/MapPointPicker";
import type { ResolutionDraft } from "./geometry";
interface Props {
  value: ResolutionDraft;
  onChange: (value: ResolutionDraft) => void;
}
export function ResolutionInputs({ value, onChange }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const evidence = {
    id: id + "-evidence",
    label: t("geography.field.evidence"),
    value: value.evidence,
    maxLength: EVIDENCE_MAX_LENGTH,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, evidence: event.target.value });
    },
  };
  return (
    <>
      <TextField {...evidence} />
      {value.decision === "move" && (
        <MapPointPicker
          label={t("geography.field.location")}
          value={parseLocation(value.location ?? "")}
          onChange={(location) => {
            onChange({ ...value, location: location.join(",") });
          }}
        />
      )}
    </>
  );
}
