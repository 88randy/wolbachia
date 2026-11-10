import { SECTIONS } from "./evaluation-domain";
import type { RubricVersion } from "./evaluation-query";
import type { EvaluationFormModel } from "./use-evaluation-form";
import { EvaluationSectionScore } from "./EvaluationSectionScore";
import { EvaluationCriticalChecks } from "./EvaluationCriticalChecks";
import styles from "./evaluations.module.css";
interface Props extends Pick<EvaluationFormModel, "draft" | "isSubmitted" | "change" | "answer"> {
  version: RubricVersion;
}
export function EvaluationScores(props: Props) {
  return (
    <div className={styles.fields}>
      {SECTIONS.map((name) => (
        <EvaluationSectionScore key={name} name={name} form={props} />
      ))}
      <EvaluationCriticalChecks form={props} version={props.version} />
    </div>
  );
}
