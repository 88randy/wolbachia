import { useTranslation } from "react-i18next";
import type { useScopeCode } from "./use-scope-code";
import styles from "./organization.module.css";
interface Props {
  id: string;
  lookup: ReturnType<typeof useScopeCode>;
}
export function ScopeCodeInput({ id, lookup }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.row}>
      <label htmlFor={id}>{t("orgAdmin.scope.code")}</label>
      <input
        id={id}
        value={lookup.code}
        maxLength={50}
        onChange={(event) => {
          lookup.setCode(event.target.value);
        }}
      />
      <button
        type="button"
        disabled={lookup.isBusy || !lookup.code.trim()}
        onClick={() => {
          void lookup.add();
        }}
      >
        {t("orgAdmin.scope.add")}
      </button>
      {lookup.isMissing && <p role="alert">{t("orgAdmin.scope.unavailable")}</p>}
    </div>
  );
}
