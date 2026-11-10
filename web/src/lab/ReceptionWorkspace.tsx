import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { NoPermissionState } from "../states/NoPermissionState";
import { ReceptionHeader } from "./ReceptionHeader";
import { ReceptionScanner } from "./ReceptionScanner";
import { ReceptionNoPaddle } from "./ReceptionNoPaddle";
import { ReceptionSummary } from "./ReceptionSummary";
import { ReceptionViewSelect } from "./ReceptionViewSelect";
import { ReceptionTable } from "./ReceptionTable";
import { useReceptionWorkspace } from "./use-reception-workspace";
import { PageFrame } from "../components/templates/PageFrame";
import { useDocumentTitle } from "../shell/use-document-title";

export function ReceptionWorkspace() {
  const { t } = useTranslation();
  const workspace = useReceptionWorkspace();
  useDocumentTitle(t("labReception.page.title"));
  const { actions, controller, view, canRead, canCount, changeView } = workspace;
  return (
    <PageFrame>
      <ReceptionHeader canCount={canCount} />
      <InlineNotice>{t("labReception.page.scope")}</InlineNotice>
      <ReceptionScanner actions={actions} />
      <ReceptionNoPaddle actions={actions} />
      <ReceptionSummary state={controller.state} />
      <ReceptionViewSelect view={view} canRead={canRead} onChange={changeView} />
      {view === "expected" && !canRead ? (
        <NoPermissionState areaId="lab" />
      ) : (
        <ReceptionTable key={view} controller={controller} view={view} actions={actions} />
      )}
    </PageFrame>
  );
}
