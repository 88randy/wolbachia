import { useT } from "../../i18n/I18nProvider.tsx";
import type { LoginNotice } from "../../auth/login-error.ts";
import { authNoticePresentation } from "./auth-notice-presentation.ts";
import { Notice } from "../../ui/Notice.tsx";

export function AuthNotice({ notice }: { readonly notice: LoginNotice | null }) {
  const t = useT();
  if (notice === null) return null;
  return (
    <Notice
      {...authNoticePresentation(notice.key)}
      message={t(
        notice.key,
        notice.minutes === undefined ? undefined : { minutes: notice.minutes },
      )}
    />
  );
}
