import type { Schemas } from "@wolbachia/api-client";
import { EvaluationResult } from "./EvaluationResult";
import { AttemptMetadata } from "./AttemptMetadata";
import { AttemptObservations } from "./AttemptObservations";
import styles from "./evaluations.module.css";
export function AttemptFacts({ attempt }: { attempt: Schemas["EvaluationAttemptRead"] }) {
  return (
    <div className={styles.stack}>
      <EvaluationResult result={{ ...attempt, score: attempt.score ?? null }} />
      <AttemptMetadata attempt={attempt} />
      <AttemptObservations attempt={attempt} />
    </div>
  );
}
