import type { IncidentType, TypeTarget, TypeScope } from "./incident-types-query";
export interface TypeEditorProps {
  scope: TypeScope;
  item?: TypeTarget;
  isReady: boolean;
  onClose: () => void;
  onReview: () => Promise<IncidentType | undefined>;
  onSaved?: (item: IncidentType) => void;
}
