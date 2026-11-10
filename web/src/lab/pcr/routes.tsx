import { createRoute } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import type { ReactElement } from "react";
import "../../router/crumb";
import { tableSearchSchema } from "../../data-table/table-search-schema";
import { authenticatedRoute } from "../../router/base-routes";
import { requirePermission } from "../../router/guards";
import { AreaErrorState } from "../../states/AreaErrorState";
import { PCR_MANAGE, PCR_READ } from "./pcr-api";
import { PcrDetailPage } from "./PcrDetailPage";
import { PcrLabsPage } from "./PcrLabsPage";
import { PcrListPage } from "./PcrListPage";
import { PcrNewPage } from "./PcrNewPage";
import { PcrResultsPage } from "./PcrResultsPage";

function pcrRoute<const Path extends string>(
  path: Path,
  permission: string,
  component: () => ReactElement,
  crumb?: MessageKey,
) {
  return createRoute({
    getParentRoute: () => authenticatedRoute,
    path,
    ...(crumb ? { staticData: { crumb } } : {}),
    validateSearch: tableSearchSchema,
    beforeLoad: ({ context }) => {
      requirePermission("lab", context.me, permission);
    },
    component,
    errorComponent: AreaErrorState,
  });
}

/** PCR tests sent to external laboratories: list, new test, labs, one test and its results. */
export const pcrRoutes = [
  pcrRoute("/lab/pcr", PCR_READ, PcrListPage, "pcr.list.title"),
  pcrRoute("/lab/pcr/new", PCR_MANAGE, PcrNewPage, "pcr.wizard.title"),
  pcrRoute("/lab/pcr/labs", PCR_READ, PcrLabsPage, "pcr.labs.title"),
  pcrRoute("/lab/pcr/$code", PCR_READ, PcrDetailPage),
  pcrRoute("/lab/pcr/$code/results", PCR_MANAGE, PcrResultsPage, "pcr.results.title"),
];
