import type { Schemas } from "@wolbachia/api-client";
import type { SqlStatement } from "../../db/sql.ts";

export type Eligibility = Schemas["EligibilityBundle"];
export type Certification = Schemas["CertificationSummary"];
export type EvaluationFeedback = Pick<
  Schemas["EvaluationRead"],
  | "id"
  | "subject_id"
  | "center_id"
  | "quadrant_id"
  | "rubric_version_id"
  | "revision"
  | "is_voided"
  | "void"
> & {
  readonly current: Pick<
    Schemas["EvaluationAttemptRead"],
    "id" | "revision" | "observed_at" | "outcome" | "reason" | "created_by" | "predecessor_id"
  > | null;
};
export interface TrainingRecords {
  readonly certificates: readonly Certification[];
  readonly evaluations: readonly EvaluationFeedback[];
  readonly hasMoreCertificates: boolean;
  readonly hasMoreEvaluations: boolean;
  readonly fetchedAt: string;
}
export interface TrainingSource {
  readonly eligibility: readonly Eligibility[];
  readonly records: TrainingRecords | null;
  readonly canReadTraining: boolean;
  readonly canReadEvaluations: boolean;
  readonly guard: SqlStatement;
}
export class TrainingUnavailable extends Error {}
