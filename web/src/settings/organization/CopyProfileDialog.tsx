/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/DialogFooter";
import { InlineNotice } from "../../ui/InlineNotice";
import { ModalDialog } from "../../ui/ModalDialog";
import styles from "../../void/void-dialog.module.css";
import { useCopyProfile } from "./use-copy-profile";
import type { Profile } from "./use-w-03";

interface Props {
  profile: Profile;
  /** Name of the source profile in the interface language. */
  name: string;
  onClose: () => void;
  onCopied: () => void;
}

/** "Copiar perfil": asks for the Spanish and English names of the copy. */
export function CopyProfileDialog({ profile, name, onClose, onCopied }: Props) {
  const { t } = useTranslation();
  const base = useId();
  const copy = useCopyProfile(profile, onCopied);
  return (
    <ModalDialog
      title={t("users.roles.copyTitle", { name })}
      onClose={onClose}
      isBusy={copy.writer.isBusy}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!copy.writer.isBusy) void copy.submit();
        }}
      >
        <p className={styles.hint}>{t("users.roles.copyHint")}</p>
        <TextField
          id={`${base}-es`}
          label={t("users.roles.copyLabelEs")}
          value={copy.labelEs}
          required
          maxLength={100}
          onChange={(event) => {
            copy.setLabelEs(event.target.value);
          }}
        />
        <TextField
          id={`${base}-en`}
          label={t("users.roles.copyLabelEn")}
          value={copy.labelEn}
          required
          maxLength={100}
          onChange={(event) => {
            copy.setLabelEn(event.target.value);
          }}
        />
        {copy.writer.error && <InlineNotice tone="critical">{t(copy.writer.error)}</InlineNotice>}
        <DialogFooter>
          <Button variant="secondary" disabled={copy.writer.isBusy} onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" loading={copy.writer.isBusy} disabled={!copy.isReady}>
            {t("users.roles.copySubmit")}
          </Button>
        </DialogFooter>
      </form>
    </ModalDialog>
  );
}
