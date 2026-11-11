/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import { InlineNotice } from "../ui/InlineNotice";
import { ModalDialog } from "../ui/ModalDialog";
import styles from "../void/void-dialog.module.css";
import { NewUserFields } from "./NewUserFields";
import { TemporaryPasswordPanel } from "./TemporaryPasswordPanel";
import { useNewUser } from "./use-new-user";

/** W48 "Nuevo usuario": create the login, assign profile and scope, then offer a temporary password. */
export function NewUserDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const flow = useNewUser();
  const { form, writer, created, isAssigned } = flow;
  const name = created?.display_name ?? "";
  if (created) {
    return (
      <ModalDialog title={t("users.new.title")} onClose={onClose} isBusy={writer.isBusy}>
        {isAssigned ? (
          <div className="flex flex-col gap-3">
            <InlineNotice tone="success">
              <p role="status">{t("users.new.created", { name })}</p>
              <p>{t("users.new.assigned")}</p>
            </InlineNotice>
            <TemporaryPasswordPanel userId={created.id} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <InlineNotice tone="warning">
              <p role="alert">{t("users.new.partial", { name })}</p>
            </InlineNotice>
            {writer.error && <InlineNotice tone="critical">{t(writer.error)}</InlineNotice>}
          </div>
        )}
        <DialogFooter>
          {!isAssigned && (
            <Button loading={writer.isBusy} onClick={() => void flow.retry()}>
              {t("users.new.retry")}
            </Button>
          )}
          <Button variant="secondary" disabled={writer.isBusy} onClick={onClose}>
            {t("users.new.close")}
          </Button>
        </DialogFooter>
      </ModalDialog>
    );
  }
  const isReady = form.isComplete && form.hasScope;
  return (
    <ModalDialog title={t("users.new.title")} onClose={onClose} isBusy={writer.isBusy}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (isReady && !writer.isBusy) void flow.submit();
        }}
      >
        <NewUserFields form={form} />
        {!form.hasScope && <p className={styles.hint}>{t("users.new.scopeRequired")}</p>}
        {writer.error && <InlineNotice tone="critical">{t(writer.error)}</InlineNotice>}
        <DialogFooter>
          <Button variant="secondary" disabled={writer.isBusy} onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" loading={writer.isBusy} disabled={!isReady}>
            {t("users.new.submit")}
          </Button>
        </DialogFooter>
      </form>
    </ModalDialog>
  );
}
