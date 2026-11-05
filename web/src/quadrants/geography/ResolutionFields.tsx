import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { ResolutionDraft } from "./geometry";
import { ResolutionDecision } from "./ResolutionDecision";
import { ResolutionInputs } from "./ResolutionInputs";
import styles from "./geography.module.css";
interface Props {
  point: Schemas["SamplingPoint"];
  value: ResolutionDraft;
  onChange: (draft: ResolutionDraft) => void;
  canCreatePoint: boolean;
  onRetire: () => void;
  isBlocked: boolean;
}
export function ResolutionFields(props: Props) {
  const { t } = useTranslation();
  const id = useId();
  const decision = {
    value: props.value,
    onChange: props.onChange,
    canCreatePoint: props.canCreatePoint,
  };
  return (
    <fieldset
      className={styles.card}
      aria-describedby={props.isBlocked ? id + "-blocked" : undefined}
    >
      <legend>{props.point.code}</legend>
      {props.isBlocked && <p id={id + "-blocked"}>{t("geography.error.unresolved")}</p>}
      <ResolutionDecision {...decision} />
      <ResolutionInputs value={props.value} onChange={props.onChange} />
      {props.canCreatePoint && (
        <button type="button" onClick={props.onRetire}>
          {t("geography.retire.title")}
        </button>
      )}
    </fieldset>
  );
}
