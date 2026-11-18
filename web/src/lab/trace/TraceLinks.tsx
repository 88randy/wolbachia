import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
import { buttonVariants } from "../../ui/button-variants";
import type { BagTrace } from "./trace-query";

/** "Ver punto" and "Ver cuadrante": only for people who may open the quadrant pages. */
export function TraceLinks({ trace }: { trace: BagTrace }) {
  const { t } = useTranslation();
  const canRead = useCan()("quadrant.read");
  if (!canRead) return null;
  const params = { code: trace.location.quadrant.code };
  const className = buttonVariants({ variant: "secondary", size: "sm" });
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        to="/quadrants/$code/points/$pointCode"
        params={{ ...params, pointCode: trace.location.point.code }}
        className={className}
      >
        {t("labTrace.map.viewPoint")} · {trace.location.point.code}
      </Link>
      <Link to="/quadrants/$code/versions" params={params} className={className}>
        {t("labTrace.map.viewQuadrant")} · {trace.location.quadrant.code}
      </Link>
    </div>
  );
}
