import { RubricFacts } from "./RubricFacts";
import { RubricVersionSelect } from "./RubricVersionSelect";
import type { RubricVersion } from "./evaluation-query";
import styles from "./evaluations.module.css";
interface Props {
  version: RubricVersion;
  onSelect?: (version: RubricVersion) => void;
  isBlocked: boolean;
}
export function RubricVersionContent({ version, onSelect, isBlocked }: Props) {
  return (
    <div className={styles.stack}>
      <RubricFacts version={version} />
      {onSelect && (
        <RubricVersionSelect version={version} onSelect={onSelect} isBlocked={isBlocked} />
      )}
    </div>
  );
}
