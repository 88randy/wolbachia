import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { useScopeCode } from "./use-scope-code";
import { ScopeCodeInput } from "./ScopeCodeInput";
import type { BeginScopeLookup, ScopeDimensionChange } from "./scope-types";
interface Props {
  id: string;
  dimension: "centers" | "quadrants";
  onChange: ScopeDimensionChange;
  beginLookup: BeginScopeLookup;
}
/** Mounted only for selected mode, keyed by request context; unmount aborts and releases lookup. */
export function ScopeCodeLookup({ id, dimension, onChange, beginLookup }: Props) {
  const { t } = useTranslation();
  const canRead = useMe().permissions.includes(
    dimension === "centers" ? "center.read" : "quadrant.read",
  );
  const lookup = useScopeCode(
    dimension,
    (identifier) => {
      onChange((current) =>
        current.mode === "selected"
          ? { ...current, ids: [...new Set([...current.ids, identifier])].sort() }
          : current,
      );
    },
    beginLookup,
  );
  return canRead ? (
    <ScopeCodeInput id={id} lookup={lookup} />
  ) : (
    <p>{t("orgAdmin.scope.unavailable")}</p>
  );
}
