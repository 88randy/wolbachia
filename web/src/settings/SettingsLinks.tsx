import { Smartphone, SlidersHorizontal, ListChecks, Building2, Users } from "lucide-react";
import styles from "./settings.module.css";
import { Link } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
const ICONS = [Smartphone, SlidersHorizontal, ListChecks, Building2, Users];
const DESCRIPTIONS = [
  "refresh.settings.phones",
  "refresh.settings.rules",
  "refresh.settings.catalogs",
  "refresh.settings.organization",
  "refresh.settings.roles",
  "incidentTypes.page.title",
] as const;
const LINKS = [
  { to: "/settings/phones", permission: "device.read", key: "phones.page.title" },
  { to: "/settings/rule-parameters", permission: "rule_parameter.read", key: "rules.page.title" },
  { to: "/settings/catalogs", permission: "catalog.read", key: "catalogs.page.title" },
  {
    to: "/settings/organization",
    permission: "organization.read",
    key: "orgAdmin.organization.title",
  },
  { to: "/settings/roles", permission: "role.read", key: "orgAdmin.roles.title" },
  {
    to: "/settings/incident-types",
    permission: "incident.manage_type",
    key: "incidentTypes.page.title",
  },
] as const satisfies readonly { to: string; permission: string; key: MessageKey }[];
export function SettingsLinks() {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <ul className={styles.grid}>
      {LINKS.map((link, index) => {
        const Icon = ICONS[index] ?? ListChecks;
        if (!can(link.permission)) return null;
        return (
          <li key={link.to}>
            <Link
              to={link.to}
              className={styles.link}
              aria-label={t(link.key)}
              aria-describedby={`settings-description-${String(index)}`}
            >
              <Icon aria-hidden="true" className={styles.icon} />
              <span className={styles.text}>
                <strong>{t(link.key)}</strong>
                <span id={`settings-description-${String(index)}`} className={styles.description}>
                  {t(DESCRIPTIONS[index] ?? "refresh.settings.description")}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
