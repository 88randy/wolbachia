/* eslint-disable max-lines-per-function -- presentational JSX of the success screen. */
import { Link } from "@tanstack/react-router";
import { CircleCheck, ImageUp, Map as MapIcon, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../../components/templates/PageFrame";
import { useDocumentTitle } from "../../shell/use-document-title";
import { buttonVariants } from "../../ui/button-variants";
import { CredentialReveal } from "../CredentialReveal";
import type { ProvisionResponse } from "../platform-queries";

interface NextStep {
  icon: LucideIcon;
  titleKey: MessageKey;
  hintKey: MessageKey;
}

const ADMIN_STEPS: readonly NextStep[] = [
  {
    icon: MapIcon,
    titleKey: "platform.done.next.quadrants",
    hintKey: "platform.done.next.quadrantsHint",
  },
  {
    icon: UserPlus,
    titleKey: "platform.done.next.people",
    hintKey: "platform.done.next.peopleHint",
  },
];

/** After creating: the one-time credential, then what comes next. */
export function WizardDone({ result }: { result: ProvisionResponse }) {
  const { t } = useTranslation();
  const { organization, admin } = result;
  useDocumentTitle(t("platform.done.title"));
  return (
    <PageFrame width="narrow">
      <section className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <header className="flex items-start gap-4">
          <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-success-bg text-success-fg">
            <CircleCheck aria-hidden="true" className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-xl font-semibold text-ink">{t("platform.done.title")}</h1>
            <p className="m-0 text-sm text-ink-2">
              {t("platform.done.description", { name: organization.name })}
            </p>
          </div>
        </header>
        <CredentialReveal username={admin.username} temporaryPassword={admin.temporary_password} />
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          <li>
            <Link
              to="/platform/$slug"
              params={{ slug: organization.slug }}
              search={{ logo: "1" }}
              className="flex items-center gap-4 rounded-xl border border-line p-4 text-ink no-underline hover:border-action hover:bg-tint"
            >
              <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-tint text-action">
                <ImageUp aria-hidden="true" className="size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{t("platform.done.next.logo")}</span>
                <span className="text-xs text-ink-2">{t("platform.done.next.logoHint")}</span>
              </span>
            </Link>
          </li>
          {ADMIN_STEPS.map(({ icon: Icon, titleKey, hintKey }) => (
            <li
              key={titleKey}
              className="flex items-center gap-4 rounded-xl border border-line p-4"
            >
              <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-neutral-bg text-ink-2">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{t(titleKey)}</span>
                <span className="text-xs text-ink-2">{t(hintKey)}</span>
              </span>
            </li>
          ))}
        </ol>
        <footer className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
          <Link to="/platform" className={buttonVariants({ variant: "secondary" })}>
            {t("platform.done.list")}
          </Link>
          <Link
            to="/platform/$slug"
            params={{ slug: organization.slug }}
            className={buttonVariants({ variant: "primary" })}
          >
            {t("platform.done.open")}
          </Link>
        </footer>
      </section>
    </PageFrame>
  );
}
