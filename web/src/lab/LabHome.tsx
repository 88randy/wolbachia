import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  FlaskConical,
  History,
  Microscope,
  PackageCheck,
  Recycle,
  Repeat2,
  Send,
  TestTubes,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HubCardItem } from "../components/templates/HubCard";
import { HomeDashboard } from "../components/templates/HomeDashboard";
import { HubGrid } from "../components/templates/HubGrid";
import { canAny } from "../session/can";
import { useMe } from "../session/use-me";
import { useCan } from "../session/use-can";
import { pendingCountOptions } from "./lab-lists";
import { pcrSummaryOptions } from "./pcr/pcr-api";
import { useLabScope } from "./use-lab-scope";

type Item = HubCardItem & { permissions: readonly string[] };

/** Lab home: what is pending first (bags to receive and count, samples without result), then every lab screen. */
export function LabHome() {
  const { t } = useTranslation();
  const me = useMe();
  const can = useCan();
  const scope = useLabScope();
  const receive = useQuery({
    ...pendingCountOptions(scope, "receive"),
    enabled: can("bag.receive") && scope.identity.isSettled,
  });
  const count = useQuery({
    ...pendingCountOptions(scope, "count"),
    enabled: can("egg_count.create") && scope.identity.isSettled,
  });
  const results = useQuery({
    ...pendingCountOptions(scope, "results"),
    enabled: can("sample.result_create") && scope.identity.isSettled,
  });
  const pcr = useQuery({
    ...pcrSummaryOptions(scope),
    enabled: can("pcr.read") && scope.identity.isSettled,
  });
  const candidates: HubCardItem[] = [
    {
      id: "pending-receive",
      icon: PackageCheck,
      link: { to: "/lab/bags" },
      title: t("lab.home.pending.receive"),
      description: t("lab.home.pending.receiveHint"),
      count: receive.data,
      tone: "warning",
    },
    {
      id: "pending-count",
      icon: FlaskConical,
      link: { to: "/lab/egg-counts" },
      title: t("lab.home.pending.count"),
      description: t("lab.home.pending.countHint"),
      count: count.data,
      tone: "warning",
    },
    {
      id: "pending-results",
      icon: Microscope,
      link: { to: "/lab/results" },
      title: t("lab.home.pending.results"),
      description: t("lab.home.pending.resultsHint"),
      count: results.data,
      tone: "warning",
    },
    {
      id: "pcr-in-process",
      icon: TestTubes,
      link: { to: "/lab/pcr" },
      title: t("pcr.home.inProcess"),
      description: t("pcr.home.inProcessHint"),
      count: pcr.data?.in_process,
      tone: "info",
    },
    {
      id: "pcr-pending-results",
      icon: TestTubes,
      link: { to: "/lab/pcr" },
      title: t("pcr.home.pendingResults"),
      description: t("pcr.home.pendingResultsHint"),
      count: pcr.data?.pending_results,
      tone: "warning",
    },
  ];
  const pending = candidates.filter((entry) => (entry.count ?? 0) > 0);
  const all: Item[] = [
    item({
      id: "bags",
      permissions: ["bag.receive"],
      icon: PackageCheck,
      to: "/lab/bags",
      text: [t("labReception.page.title"), t("hub.lab.bags")],
    }),
    item({
      id: "egg-counts",
      permissions: ["egg_count.create"],
      icon: FlaskConical,
      to: "/lab/egg-counts",
      text: [t("lab.count.title"), t("hub.lab.eggCounts")],
    }),
    item({
      id: "recounts",
      permissions: ["recount.create", "recount.adjudicate"],
      icon: Repeat2,
      to: "/lab/recounts",
      text: [t("lab.recounts.title"), t("lab.hub.recounts")],
    }),
    item({
      id: "results",
      permissions: ["sample.read"],
      icon: Microscope,
      to: "/lab/results",
      text: [t("lab.results.title"), t("lab.hub.results")],
    }),
    item({
      id: "pcr",
      permissions: ["pcr.read"],
      icon: TestTubes,
      to: "/lab/pcr",
      text: [t("pcr.list.title"), t("pcr.home.card")],
    }),
    item({
      id: "shipments",
      permissions: ["shipment.read"],
      icon: Send,
      to: "/lab/shipments",
      text: [t("lab.shipments.title"), t("lab.hub.shipments")],
    }),
    item({
      id: "paddles",
      permissions: ["egg_paddle.reuse"],
      icon: Recycle,
      to: "/lab/paddles",
      text: [t("lab.paddles.title"), t("lab.hub.paddles")],
    }),
    item({
      id: "materials",
      permissions: ["material_request.read"],
      icon: Boxes,
      to: "/lab/material-requests",
      text: [t("lab.materials.title"), t("lab.hub.materials")],
    }),
    item({
      id: "write-offs",
      permissions: ["bag.dispose"],
      icon: Trash2,
      to: "/lab/write-offs",
      text: [t("allocation.lab.title"), t("hub.lab.writeOffs")],
    }),
    item({
      id: "history",
      permissions: ["egg_count.read"],
      icon: History,
      to: "/lab/count-history",
      text: [t("lab.history.title"), t("hub.lab.history")],
    }),
  ];
  const items = all.filter((entry) => canAny(me, entry.permissions));
  return (
    <HomeDashboard
      title={t("shell.nav.lab")}
      description={t("hub.lab.description")}
      pending={pending}
      isLoading={receive.isPending || count.isPending || results.isPending}
    >
      <section aria-labelledby="lab-more" className="flex flex-col gap-3">
        <h2 id="lab-more" className="m-0 text-base font-semibold">
          {t("lab.home.more")}
        </h2>
        <HubGrid items={items} label={t("lab.home.more")} />
      </section>
    </HomeDashboard>
  );
}

interface ItemSpec {
  id: string;
  permissions: readonly string[];
  icon: HubCardItem["icon"];
  to: HubCardItem["link"]["to"];
  text: [title: string, description: string];
}

function item({ id, permissions, icon, to, text }: ItemSpec): Item {
  return { id, permissions, icon, link: { to }, title: text[0], description: text[1] };
}
