import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import page from "../../styles/page.module.css";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { InlineNotice } from "../../ui/InlineNotice";
import { PermitsHeader } from "./PermitsHeader";
import { PermitTypeDialog } from "./PermitTypeDialog";
import { PermitTypesTable } from "./PermitTypesTable";
import { useOpenState } from "./use-open-state";
import { usePermitTypesScreen } from "./use-permit-types-screen";

/**
 * W43, permit types. The empty state explains what a type is for and offers the first one.
 * Creating needs `permit.manage` with whole-organization scope; otherwise the button is disabled
 * and the reason is on screen. A type is immutable: no edit, no delete.
 */
export function W43Page() {
  const { t } = useTranslation();
  useDocumentTitle(t("permits.types.title"));
  const screen = usePermitTypesScreen();
  const dialog = useOpenState();
  const label = screen.isFirstUse ? "permits.types.createFirst" : "permits.types.create";
  const create = (
    <Button disabled={!screen.canCreate} onClick={dialog.open}>
      {t(label)}
    </Button>
  );
  return (
    <section className={page.page}>
      <PermitsHeader title={t("permits.types.title")} hint={t("permits.types.hint")}>
        {!screen.isFirstUse && create}
      </PermitsHeader>
      {!screen.canCreate && <InlineNotice>{t("permits.types.noScope")}</InlineNotice>}
      {screen.isFirstUse ? (
        <EmptyState kind="noData" message={t("permits.types.emptyHint")} action={create} />
      ) : (
        <PermitTypesTable screen={screen} />
      )}
      {dialog.isOpen && <PermitTypeDialog onClose={dialog.close} onCreated={dialog.close} />}
    </section>
  );
}
