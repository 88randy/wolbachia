/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { FolderTabs } from "../../ui/FolderTabs";
import { AccessTab } from "./AccessTab";
import { ReceiptsTab } from "./ReceiptsTab";

export type AccessLogTab = "access" | "exports";

/** W60: who viewed or exported personal data. Two tabs, one address each so each can be shared. */
export function AccessLogPage({ tab }: { tab: AccessLogTab }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <ListPage title={t("regulatory.access.title")} description={t("regulatory.access.description")}>
      <FolderTabs
        label={t("regulatory.access.tabs")}
        value={tab}
        onValueChange={(next) => {
          void navigate({
            to:
              next === "exports"
                ? "/regulatory/access-log/export-receipts"
                : "/regulatory/access-log",
          });
        }}
        items={[
          {
            value: "access",
            label: t("regulatory.access.tab.access"),
            content: tab === "access" ? <AccessTab /> : null,
          },
          {
            value: "exports",
            label: t("regulatory.access.tab.exports"),
            content: tab === "exports" ? <ReceiptsTab /> : null,
          },
        ]}
      />
    </ListPage>
  );
}
