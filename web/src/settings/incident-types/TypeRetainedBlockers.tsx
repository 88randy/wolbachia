import { useTranslation } from "react-i18next";
import { incidentBlockerKey } from "../../incidents/incident-labels";
import { isConfiguredType } from "./incident-types-query";
import type { TypeTarget } from "./incident-types-query";
export function TypeRetainedBlockers({ item }: { item?: TypeTarget }) {
  const { t } = useTranslation();
  if (!isConfiguredType(item)) return null;
  const kinds: unknown[] = Array.isArray(item.blocker_kinds)
    ? item.blocker_kinds
    : [item.blocker_kinds];
  return (
    <section aria-label={t("incidentTypes.field.blockers")}>
      <p>{t("incidentTypes.form.retainedBlockers")}</p>
      <ul>
        {kinds.map((kind, index) => (
          <li key={index}>
            {typeof kind === "string"
              ? t(incidentBlockerKey(kind))
              : t("incidents.blocker.unknown")}{" "}
            <code>{typeof kind === "string" ? kind : JSON.stringify(kind)}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
