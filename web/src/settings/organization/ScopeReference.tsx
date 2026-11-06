import { useTranslation } from "react-i18next";
import { useScopeReference } from "./use-scope-reference";
interface Props {
  id: string;
  dimension: "centers" | "quadrants";
  onRemove: () => void;
}
export function ScopeReference({ id, dimension, onRemove }: Props) {
  const { t } = useTranslation();
  const query = useScopeReference({ id, dimension });
  const label = query.data ?? t("orgAdmin.scope.unavailable");
  return (
    <li>
      {label}
      <button
        type="button"
        aria-label={`${t("orgAdmin.scope.remove")}: ${label}`}
        onClick={onRemove}
      >
        {t("orgAdmin.scope.remove")}
      </button>
    </li>
  );
}
