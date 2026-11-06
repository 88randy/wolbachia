import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLogo } from "./use-logo";
import styles from "./organization.module.css";
interface Props {
  name: string;
  url: string | null;
  revision: number;
}
export function LogoMark({ name, url, revision }: Props) {
  const { t } = useTranslation();
  const source = useLogo(url, revision);
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase();
  return source && failed !== source ? (
    <img
      className={styles.logo}
      src={source}
      alt={t("orgAdmin.brand.logo")}
      onError={() => {
        setFailed(source);
      }}
    />
  ) : (
    <span className={styles.initials} aria-label={t("orgAdmin.brand.initials")}>
      {initials}
    </span>
  );
}
