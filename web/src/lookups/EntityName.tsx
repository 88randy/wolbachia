import type { EntityKind } from "./entity-sources";
import { isUuid } from "./entity-sources";
import { useEntityLabel } from "./use-entity-label";
import { EmptyValue } from "../ui/EmptyValue";

interface EntityNameProps {
  kind: EntityKind;
  /** The referenced id (or an already human value, shown as is). */
  id: string | null | undefined;
  /** Also show the human code in muted text after the name. */
  withCode?: boolean;
}

/** Renders a reference by its name. A raw id never reaches the screen: unresolved shows "—". */
export function EntityName({ kind, id, withCode = false }: EntityNameProps) {
  const entity = useEntityLabel(kind, id);
  if (!id) return <EmptyValue />;
  if (!isUuid(id)) return <>{id}</>;
  if (!entity) return <EmptyValue />;
  return (
    <span>
      {entity.label}
      {withCode && entity.detail && (
        <span className="ml-1.5 text-xs text-ink-3">{entity.detail}</span>
      )}
    </span>
  );
}
