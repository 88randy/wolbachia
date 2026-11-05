import { Link } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
const LINKS = [
  { to: "/settings/phones", permission: "device.read", key: "phones.page.title" },
  { to: "/settings/rule-parameters", permission: "rule_parameter.read", key: "rules.page.title" },
  {
    to: "/settings/organization",
    permission: "organization.read",
    key: "orgAdmin.organization.title",
  },
  { to: "/settings/roles", permission: "role.read", key: "orgAdmin.roles.title" },
] as const satisfies readonly { to: string; permission: string; key: MessageKey }[];
export function SettingsLinks() {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <ul>
      {LINKS.filter((link) => can(link.permission)).map((link) => (
        <li key={link.to}>
          <Link to={link.to}>{t(link.key)}</Link>
        </li>
      ))}
    </ul>
  );
}
