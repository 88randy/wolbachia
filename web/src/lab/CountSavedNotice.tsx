import { useTranslation } from "react-i18next";

/** Include the saved bag so consecutive server confirmations each update the live region. */
export function CountSavedNotice({ code }: { code: string | undefined }) {
  const { t } = useTranslation();
  return (
    <p role="status" aria-atomic="true">
      {code && (
        <>
          <span>{code}</span> <span>{t("lab.count.saved")}</span>
        </>
      )}
    </p>
  );
}
