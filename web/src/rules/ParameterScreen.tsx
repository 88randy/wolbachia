import type { ReactNode } from "react";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import page from "../styles/page.module.css";
import { NewVersionForm } from "./NewVersionForm";
import { ParameterSummary } from "./ParameterSummary";
import { ParameterHeading } from "./ParameterHeading";
import { VersionHistory } from "./VersionHistory";
import { useParameterLabels } from "./parameter-labels";
import {
  CATALOG_READ,
  RULE_VERSION_CREATE,
  RULE_VERSION_READ,
  RULE_VERSION_VOID,
} from "./permissions";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";
export function ParameterScreen({
  parameter,
  notice,
}: {
  parameter: RuleParameter;
  notice: ReactNode;
}) {
  const can = useCan();
  const canVoid = can(RULE_VERSION_VOID) && can(CATALOG_READ);
  const name = useParameterLabels().name(parameter.key);
  useDocumentTitle(name);
  return (
    <section className={page.page}>
      <ParameterHeading name={name} parameterKey={parameter.key} />
      <div className={styles.content}>
        {notice}
        <ParameterSummary parameter={parameter} />
        {can(RULE_VERSION_CREATE) && <NewVersionForm parameter={parameter} />}
        {can(RULE_VERSION_READ) && <VersionHistory parameter={parameter} canVoid={canVoid} />}
      </div>
    </section>
  );
}
