import { Link } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { useMe } from "../session/use-me";
import { hasCenterScope } from "../centers/center-selection";
const LINKS = [
  {
    to: "/settings/phones",
    permission: "device.read",
    key: "phones.page.title",
    needsScope: false,
  },
  {
    to: "/settings/rule-parameters",
    permission: "rule_parameter.read",
    key: "rules.page.title",
    needsScope: false,
  },
  {
    to: "/settings/organization",
    permission: "organization.read",
    key: "orgAdmin.organization.title",
    needsScope: true,
  },
  { to: "/settings/roles", permission: "role.read", key: "orgAdmin.roles.title", needsScope: true },
] as const satisfies readonly {
  to: string;
  permission: string;
  key: MessageKey;
  needsScope: boolean;
}[];
export function SettingsLinks() {
  const { t } = useTranslation();
  const can = useCan();
  const hasScope = hasCenterScope(useMe().scope);
  return (
    <ul>
      {LINKS.filter((link) => can(link.permission) && (!link.needsScope || hasScope)).map(
        (link) => (
          <li key={link.to}>
            <Link to={link.to}>{t(link.key)}</Link>
          </li>
        ),
      )}
    </ul>
  );
}
