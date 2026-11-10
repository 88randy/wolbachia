import { useTranslation } from "react-i18next";

export function ReceptionHeader({ canCount }: { canCount: boolean }) {
  const { t } = useTranslation();
  return (
    <header>
      <h1>{t("labReception.page.title")}</h1>
      <p>{t("labReception.page.subtitle")}</p>
      {canCount && <a href="/lab/egg-counts">{t("labReception.action.countQueue")}</a>}
    </header>
  );
}
