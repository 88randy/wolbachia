/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "../ui/Button";
import { InlineNotice } from "../ui/InlineNotice";
import { useRfcReveal } from "./use-rfc-reveal";

interface Props {
  personId: string;
  hasRfc: boolean;
  canReveal: boolean;
}

/** RFC locked by default; "Show" is logged by the backend and never cached here. */
export function RfcField({ personId, hasRfc, canReveal }: Props) {
  const { t } = useTranslation();
  const rfc = useRfcReveal(personId);
  if (!hasRfc) return <span className="text-ink-2">{t("users.rfc.none")}</span>;
  const shown = rfc.state.kind === "shown" ? rfc.state.rfc : null;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {shown ? (
          <span className="font-mono font-semibold tracking-wide text-ink">{shown}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-ink-2">
            <Lock aria-hidden="true" className="size-3.5 text-warning-fg" />
            <span aria-label={t("users.rfc.hidden")}>{t("users.rfc.mask")}</span>
          </span>
        )}
        {canReveal && (
          <Button
            size="sm"
            variant="ghost"
            loading={rfc.state.kind === "loading"}
            leadingIcon={shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            onClick={shown ? rfc.hide : rfc.reveal}
          >
            {t(shown ? "users.rfc.hide" : "users.rfc.show")}
          </Button>
        )}
      </div>
      {shown && <InlineNotice tone="warning">{t("users.rfc.logged")}</InlineNotice>}
      {rfc.state.kind === "failed" && (
        <InlineNotice tone="critical">{t("users.rfc.failed")}</InlineNotice>
      )}
    </div>
  );
}
