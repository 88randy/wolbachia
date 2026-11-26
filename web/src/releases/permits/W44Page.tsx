import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { Button } from "../../ui/Button";
import { buttonVariants } from "../../ui/button-variants";
import { PermitDialog } from "./PermitDialog";
import { PermitsTable } from "./PermitsTable";
import { useOpenState } from "./use-open-state";
import { usePermitsScreen } from "./use-permits-screen";

/**
 * W44, permits. Server paging, search and order live in the address; the record shows the zone as
 * a vertex table. Creating needs `permit.manage` and a quadrant in scope; otherwise the button is
 * disabled and its reason is on the button.
 */
export function W44Page() {
  const { t } = useTranslation();
  const { controller, query, canCreate } = usePermitsScreen();
  const dialog = useOpenState();
  const actions = (
    <>
      <Link to="/releases/permit-types" className={buttonVariants({ variant: "tertiary" })}>
        {t("permits.list.typesLink")}
      </Link>
      <Button
        disabled={!canCreate}
        title={canCreate ? undefined : t("permits.list.noScope")}
        onClick={dialog.open}
      >
        {t("permits.list.create")}
      </Button>
    </>
  );
  return (
    <ListPage title={t("permits.list.title")}>
      <PermitsTable controller={controller} query={query} actions={actions} />
      {dialog.isOpen && <PermitDialog onClose={dialog.close} onSaved={dialog.close} />}
    </ListPage>
  );
}
