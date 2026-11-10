import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { blockerKeys } from "../inventory-fields";
export function TransferBlockers({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!(error instanceof ApiError)) return null;
  return (
    <ul>
      {error.envelope?.blocked_by?.map((blocker, index) => (
        <li key={index}>
          {t(blockerKeys[blocker.reason] ?? "inventory.blocker.unknown")}{" "}
          {t("errors.api.blocked", { role: blocker.unblocked_by_role })}
        </li>
      ))}
    </ul>
  );
}
