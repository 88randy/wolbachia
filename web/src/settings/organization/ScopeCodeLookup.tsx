import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { useScopeCode } from "./use-scope-code";
import { ScopeCodeInput } from "./ScopeCodeInput";
import type { BeginScopeLookup, ScopeLookupIntent, ScopeDimensionName } from "./scope-types";
interface Props {
  id: string;
  dimension: ScopeDimensionName;
  editor: ScopeLookupIntent;
  beginLookup: BeginScopeLookup;
}
/** Context/intent keys expire requests; the reducer independently validates their captured intent. */
export function ScopeCodeLookup({ id, dimension, editor, beginLookup }: Props) {
  const { t } = useTranslation();
  const canRead = useMe().permissions.includes(
    dimension === "centers" ? "center.read" : "quadrant.read",
  );
  const lookup = useScopeCode(dimension, editor, beginLookup);
  return canRead ? (
    <ScopeCodeInput id={id} lookup={lookup} />
  ) : (
    <p>{t("orgAdmin.scope.unavailable")}</p>
  );
}
