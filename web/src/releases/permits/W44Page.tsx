import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import page from "../../styles/page.module.css";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import { PermitDialog } from "./PermitDialog";
import { PermitsHeader } from "./PermitsHeader";
import { PermitsTable } from "./PermitsTable";
import { useOpenState } from "./use-open-state";
import { usePermitsScreen } from "./use-permits-screen";

/**
 * W44, permits. Server paging, search and order live in the address; the record shows the zone as
 * a vertex table. Creating needs `permit.manage` and a quadrant in scope; otherwise the button is
 * disabled and the reason is on screen.
 */
export function W44Page() {
  const { t } = useTranslation();
  useDocumentTitle(t("permits.list.title"));
  const { controller, query, canCreate } = usePermitsScreen();
  const dialog = useOpenState();
  return (
    <section className={page.page}>
      <PermitsHeader title={t("permits.list.title")} hint={t("permits.list.hint")}>
        <Button disabled={!canCreate} onClick={dialog.open}>
          {t("permits.list.create")}
        </Button>
      </PermitsHeader>
      {!canCreate && <InlineNotice>{t("permits.list.noScope")}</InlineNotice>}
      <Link to="/releases/permit-types">{t("permits.list.typesLink")}</Link>
      <PermitsTable controller={controller} query={query} />
      {dialog.isOpen && <PermitDialog onClose={dialog.close} onSaved={dialog.close} />}
    </section>
  );
}
