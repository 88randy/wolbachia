import { ApiError } from "@wolbachia/api-client";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { tableErrorKey } from "../data-table/table-error";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import page from "../styles/page.module.css";
import { NotFoundState } from "../states/NotFoundState";
import { NewVersionForm } from "./NewVersionForm";
import { ParameterSummary } from "./ParameterSummary";
import { VersionHistory } from "./VersionHistory";
import { useParameterLabels } from "./parameter-labels";
import { RULE_VERSION_CREATE, RULE_VERSION_READ, RULE_VERSION_VOID } from "./permissions";
import { parameterQueryOptions } from "./rules-query";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";

/** The API's key format (`^[a-z][a-z0-9_]*$`): anything else cannot name a parameter. */
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const HTTP_NOT_FOUND = 404;

function ParameterScreen({ parameter }: { parameter: RuleParameter }) {
  const { t } = useTranslation();
  const can = useCan();
  const name = useParameterLabels().name(parameter.key);
  useDocumentTitle(name);
  return (
    <section className={page.page}>
      <Link to="/settings/rule-parameters" className={styles.back}>
        <ArrowLeft className={styles.badgeIcon} aria-hidden="true" />
        {t("rules.detail.back")}
      </Link>
      <div className={styles.heading}>
        <h1 className={page.title}>{name}</h1>
        <span className={styles.code}>
          {t("rules.detail.key")}: <code>{parameter.key}</code>
        </span>
      </div>
      <div className={styles.content}>
        <ParameterSummary parameter={parameter} />
        {can(RULE_VERSION_CREATE) && <NewVersionForm parameter={parameter} />}
        {can(RULE_VERSION_READ) && (
          <VersionHistory parameter={parameter} canVoid={can(RULE_VERSION_VOID)} />
        )}
      </div>
    </section>
  );
}

function LoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <section className={page.page} role="alert">
      <p className={page.body}>{t(tableErrorKey(error))}</p>
      <div className={page.actions}>
        <button
          type="button"
          className={classNames(buttons.button, buttons.primary)}
          onClick={onRetry}
        >
          {t("common.actions.retry")}
        </button>
      </div>
    </section>
  );
}

function ParameterLoader({ parameterKey }: { parameterKey: string }) {
  const { t } = useTranslation();
  const client = useApiClient();
  const query = useQuery(parameterQueryOptions(client, parameterKey));
  const { error } = query;
  if (error instanceof ApiError && error.status === HTTP_NOT_FOUND) {
    return <NotFoundState />;
  }
  if (error !== null) {
    return <LoadFailed error={error} onRetry={() => void query.refetch()} />;
  }
  if (query.data === undefined) {
    return (
      <p className={page.page} role="status">
        {t("rules.detail.loading")}
      </p>
    );
  }
  return <ParameterScreen parameter={query.data} />;
}

/**
 * W62, one parameter: its value in force, the form for a new version and the history. The key in
 * the address is the parameter's human code; the organization never appears in it.
 */
export function RuleParameterPage() {
  const { key } = useParams({ strict: false });
  if (key === undefined || !KEY_PATTERN.test(key)) return <NotFoundState />;
  return <ParameterLoader parameterKey={key} />;
}
