import type { Schemas } from "@wolbachia/api-client";
export type OwnerChoice = Schemas["IncidentTypeConfigurationOwnerOption"];
export interface OwnerFieldProps {
  name: "supervisor_id" | "coordinator_id" | "terminal_id";
  label: string;
  value: string;
  retainedLabel?: string | null;
  isTerminal?: boolean;
  onChange: (value: string) => void;
  onEligibility: (isEligible: boolean) => void;
}
