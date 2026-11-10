import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { Refreshing } from "../../ui/Refreshing";
import type { Relocation } from "./relocations-query";
import type { RelocationDecisionProps } from "./RelocationDecision";
import type { useRelocationRecord } from "./use-relocation-record";
import { RelocationSnapshot } from "./RelocationSnapshot";
import { RelocationReceipt } from "./RelocationReceipt";
import { RelocationDecisionForm } from "./RelocationDecisionForm";
import { RelocationCommandFeedback } from "./RelocationCommandFeedback";
import styles from "./relocations.module.css";
interface ContentProps extends RelocationDecisionProps {
  proposal: Relocation;
  form: ReturnType<typeof useRelocationRecord>;
}
export function RelocationDecisionContent({ form, ...props }: ContentProps) {
  const { t } = useTranslation();
  const feedback = {
    command: form.command,
    isFetching: form.query.isFetching,
    onRefresh: () => {
      void form.refresh();
    },
  };
  const controls = { ...props, command: form.command, isVerified: !form.query.isFetching };
  return (
    <div className={styles.content}>
      {form.query.isFetching && <Refreshing />}
      <RelocationSnapshot proposal={props.proposal} />
      <InlineNotice tone="info">{t("relocations.workspace.historyPolicy")}</InlineNotice>
      <RelocationCommandFeedback {...feedback} />
      {form.command.receipt ? (
        <RelocationReceipt receipt={form.command.receipt} />
      ) : (
        <RelocationDecisionForm {...controls} />
      )}
    </div>
  );
}
