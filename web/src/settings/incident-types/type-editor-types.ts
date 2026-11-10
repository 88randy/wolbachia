import type { TypeDraft } from "./type-draft";
import type { TypeTarget } from "./incident-types-query";
export interface TypeFieldProps {
  draft: TypeDraft;
  item?: TypeTarget;
  change: <Key extends keyof TypeDraft>(name: Key, value: TypeDraft[Key]) => void;
  fields?: Readonly<Record<string, readonly unknown[]>>;
}
