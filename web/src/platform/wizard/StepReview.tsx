/* eslint-disable max-lines-per-function -- presentational JSX of the review step. */
import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DescriptionGrid } from "../../components/templates/DescriptionGrid";
import { Button } from "../../ui/Button";
import { zoneLabel } from "./timezones";
import type { OrganizationDraft } from "./wizard-draft";

interface ReviewProps {
  draft: OrganizationDraft;
  onEdit: (step: number) => void;
}

function Section(props: {
  title: string;
  step: number;
  onEdit: (step: number) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line p-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold text-ink">{props.title}</h3>
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<Pencil aria-hidden="true" />}
          onClick={() => {
            props.onEdit(props.step);
          }}
        >
          {t("platform.review.edit")}
        </Button>
      </header>
      {props.children}
    </section>
  );
}

export function StepReview({ draft, onEdit }: ReviewProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("platform.review.organization")} step={1} onEdit={onEdit}>
        <DescriptionGrid
          items={[
            { label: t("platform.field.name"), value: draft.name },
            { label: t("platform.field.slug"), value: draft.slug },
          ]}
        />
      </Section>
      <Section title={t("platform.review.region")} step={2} onEdit={onEdit}>
        <DescriptionGrid
          items={[
            {
              label: t("platform.field.country"),
              value: t(`platform.country.${draft.country as "MX"}`),
            },
            { label: t("platform.field.timezone"), value: zoneLabel(draft.timezone) },
            {
              label: t("platform.field.epiWeek"),
              value: t(
                draft.epiWeek === "iso"
                  ? "platform.field.epiWeekIso"
                  : "platform.field.epiWeekMmwr",
              ),
            },
            {
              label: t("platform.field.languages"),
              value: draft.languages
                .map((language) => t(`platform.language.${language}`))
                .join(", "),
            },
          ]}
        />
      </Section>
      <Section title={t("platform.review.centers")} step={3} onEdit={onEdit}>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {draft.centers.map((center) => (
            <li key={center.key} className="flex items-center gap-3 text-sm">
              <span className="rounded-md bg-tint px-2 py-0.5 text-xs font-semibold text-action">
                {center.code}
              </span>
              <span className="text-ink">{center.name}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t("platform.review.admin")} step={4} onEdit={onEdit}>
        <DescriptionGrid
          items={[
            { label: t("platform.field.firstName"), value: `${draft.firstName} ${draft.lastName}` },
            { label: t("platform.field.username"), value: draft.username },
            { label: t("platform.field.email"), value: draft.email },
            {
              label: t("platform.field.delivery"),
              value: t(
                draft.delivery === "password"
                  ? "platform.field.deliveryPassword"
                  : "platform.field.deliveryInvite",
              ),
            },
          ]}
        />
      </Section>
    </div>
  );
}
