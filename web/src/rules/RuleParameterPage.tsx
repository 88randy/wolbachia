import type { ReactNode } from "react";
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
import {
  CATALOG_READ,
  RULE_VERSION_CREATE,
  RULE_VERSION_READ,
  RULE_VERSION_VOID,
} from "./permissions";
import { parameterQueryOptions } from "./rules-query";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";

/** The API's key format (`^[a-z][a-z0-9_]*$`): anything else cannot name a parameter. */
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const HTTP_NOT_FOUND = 404;

function RefreshFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="status" className={styles.card}>
      <p className={styles.hint}>{t("rules.detail.refreshFailed")}</p>
      <div className={page.actions}>
        <button
          type="button"
          className={classNames(buttons.button, buttons.secondary)}
          onClick={onRetry}
        >
          {t("common.actions.retry")}
        </button>
      </div>
    </div>
  );
}

function ParameterScreen({ parameter, notice }: { parameter: RuleParameter; notice: ReactNode }) {
  const { t } = useTranslation();
  const can = useCan();
  const canVoid = can(RULE_VERSION_VOID) && can(CATALOG_READ);
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
        {notice}
        <ParameterSummary parameter={parameter} />
        {can(RULE_VERSION_CREATE) && <NewVersionForm parameter={parameter} />}
        {can(RULE_VERSION_READ) && <VersionHistory parameter={parameter} canVoid={canVoid} />}
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
  const retry = () => void query.refetch();
  // A failed refresh keeps what is on screen (the form holds a draft): only a first load fails.
  if (query.data !== undefined) {
    const notice = error === null ? null : <RefreshFailed onRetry={retry} />;
    return <ParameterScreen parameter={query.data} notice={notice} />;
  }
  if (error instanceof ApiError && error.status === HTTP_NOT_FOUND) return <NotFoundState />;
  if (error !== null) return <LoadFailed error={error} onRetry={retry} />;
  return (
    <p className={page.page} role="status">
      {t("rules.detail.loading")}
    </p>
  );
}

/**
 * W62, one parameter: its value in force, the form for a new version and the history. The key in
 * the address is the parameter's human code; the organization never appears in it.
 */
export function RuleParameterPage() {
  const { key } = useParams({ strict: false });
  if (key === undefined || !KEY_PATTERN.test(key)) return <NotFoundState />;
  // Another key is another record: remount, so a draft and a pending request stay with their own.
  return <ParameterLoader key={key} parameterKey={key} />;
}
