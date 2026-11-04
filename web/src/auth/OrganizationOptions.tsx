import { useTranslation } from "react-i18next";
import type { Me } from "../session/me";
import utilities from "../styles/utilities.module.css";
import styles from "./auth.module.css";
import { OrganizationOption } from "./OrganizationOption";

interface OrganizationOptionsProps {
  organizations: Me["organizations"];
  chosen: string;
  onChoose: (slug: string) => void;
}

/** The radio group: a fieldset whose legend names it for screen readers. */
export function OrganizationOptions({ organizations, chosen, onChoose }: OrganizationOptionsProps) {
  const { t } = useTranslation();
  return (
    <fieldset className={styles.options}>
      <legend className={utilities.srOnly}>{t("auth.organization.legend")}</legend>
      {organizations.map(({ slug, name }) => (
        <OrganizationOption
          key={slug}
          slug={slug}
          name={name}
          isChecked={slug === chosen}
          onChoose={onChoose}
        />
      ))}
    </fieldset>
  );
}
