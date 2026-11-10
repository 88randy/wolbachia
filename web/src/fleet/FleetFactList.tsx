import type { ReactNode } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { Fragment } from "react";
import styles from "./fleet.module.css";
export type FleetFact = readonly [MessageKey, ReactNode];
/** Actual record facts, with the same wrapping and domain labels in every history. */
export function FleetFactList({ facts }: { facts: readonly FleetFact[] }) {
  const { t } = useTranslation();
  return (
    <dl className={styles.summary}>
      {facts.map(([key, value]) => (
        <Fragment key={key}>
          <dt>{t(key)}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
