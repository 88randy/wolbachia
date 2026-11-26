import { Link, useNavigate } from "@tanstack/react-router";
import type { Schemas } from "@wolbachia/api-client";
import { Bike, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { cn } from "@/lib/utils";
import { StatusPill } from "../../ui/StatusPill";
import { PositionAge } from "./PositionAge";
import type { LivePosition } from "./use-live-tracking";

interface Props {
  shift: Schemas["Shift"];
  name: string;
  places: readonly string[];
  isChosen: boolean;
  /** `null` hides the position line (no `courier_track.read`). */
  position: LivePosition | undefined | null;
}

/** One courier in the field: shift facts, last position and the focus/detail actions. */
export function LiveShiftItem({ shift, name, places, isChosen, position }: Props) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-line p-3",
        isChosen && "border-action bg-tint",
      )}
    >
      <ShiftHeading name={name} />
      <p className="m-0 flex items-center gap-2 text-[13px] text-ink-2">
        <Clock aria-hidden="true" className="size-3.5" />
        {t("live.since", { time: format(shift.opened_at_device) })}
        {" · "}
        {shift.motorcycle_code}
      </p>
      {position !== null && <PositionAge position={position} />}
      {places.length > 0 && (
        <p className="m-0 text-[13px] text-ink-2">
          {t("live.quadrants", { list: places.join(", ") })}
        </p>
      )}
      <LiveShiftActions shift={shift} isChosen={isChosen} />
    </li>
  );
}

function ShiftHeading({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-2 font-semibold text-ink">
        <Bike aria-hidden="true" className="size-4 text-action" />
        {name}
      </span>
      <StatusPill tone="success">{t("live.working")}</StatusPill>
    </div>
  );
}

function LiveShiftActions({ shift, isChosen }: Pick<Props, "shift" | "isChosen">) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap gap-3 text-[13px] font-semibold">
      <button
        type="button"
        className="min-h-8 cursor-pointer rounded-lg border-0 bg-transparent px-1 text-action-strong underline"
        onClick={() => {
          void navigate({ to: ".", search: isChosen ? {} : { courier: shift.courier } });
        }}
      >
        {t(isChosen ? "live.showAll" : "live.focus")}
      </button>
      <Link
        to="/operations/shifts/$code"
        params={{ code: shift.code }}
        className="inline-flex min-h-8 items-center text-action-strong"
      >
        {t("live.details")}
      </Link>
    </div>
  );
}
