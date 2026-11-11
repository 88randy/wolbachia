import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { statusOf } from "./use-assignment-panel";

function Entry(props: { title: string; detail?: string | undefined; tone?: "warning" }) {
  return (
    <li className="flex min-w-0 flex-col gap-0.5 border-l-2 border-line pl-4">
      <span
        className={`text-sm font-semibold ${props.tone === "warning" ? "text-warning-fg" : "text-ink"}`}
      >
        {props.title}
      </span>
      {props.detail && <span className="text-[13px] text-ink-2">{props.detail}</span>}
    </li>
  );
}

/** What happened, in order: planned, handed out (with signature), received, or voided with reason. */
export function DeliveryTimeline({ assignment }: { assignment: Schemas["SupplyAssignmentRead"] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const life = assignment.lifecycle;
  const status = statusOf(assignment);
  return (
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      <Entry
        title={t("allocation.delivery.timeline.planned")}
        detail={t("allocation.delivery.timeline.revision", { number: assignment.revision })}
      />
      {life?.release_id && (
        <Entry
          title={t("allocation.delivery.timeline.released")}
          detail={t("allocation.delivery.timeline.by", {
            name: life.released_by_name ?? "—",
            when: life.released_at ? format(life.released_at) : "—",
          })}
        />
      )}
      {life?.signature && (
        <Entry
          title={t(`allocation.delivery.signature.${life.signature.state}`)}
          detail={
            life.signature.channel
              ? t(`allocation.delivery.channel.${life.signature.channel}`, {
                  name: life.signature.captured_by ?? "—",
                })
              : t("allocation.delivery.channel.waiting")
          }
        />
      )}
      {status === "received" && <Entry title={t("allocation.delivery.timeline.received")} />}
      {life?.cancelled_at && (
        <Entry
          tone="warning"
          title={t("allocation.delivery.timeline.cancelled")}
          detail={t("allocation.delivery.timeline.cancelDetail", {
            name: life.cancelled_by_name ?? "—",
            when: format(life.cancelled_at),
            reason: life.cancel_reason ?? "—",
          })}
        />
      )}
    </ol>
  );
}
