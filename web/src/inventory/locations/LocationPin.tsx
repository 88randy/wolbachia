import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Building2, Factory, Layers, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PIN_SHAPE } from "./location-pins";
import type { Location, LocationCluster } from "./location-pins";
import styles from "../inventory.module.css";

const KIND_ICON: Record<Location["kind"], LucideIcon> = {
  center: Building2,
  warehouse: Warehouse,
  biofactory: Factory,
};

export function KindIcon({ kind }: { kind: Location["kind"] }) {
  const Icon = KIND_ICON[kind];
  return <Icon aria-hidden="true" />;
}

interface Props {
  cluster: LocationCluster;
  expanded: boolean;
  onOpen: (key: string, element: HTMLElement) => void;
}

function pinLabel(cluster: LocationCluster, t: TFunction): string {
  const [only, ...rest] = cluster.locations;
  if (!only) return "";
  if (rest.length > 0) return t("inventory.map.clusterPin", { count: cluster.locations.length });
  return t("inventory.map.pin", {
    code: only.code,
    name: only.name,
    kind: t(`inventory.option.${only.kind}`),
  });
}

/**
 * A small pin: icon + shape by location type, or a count badge for several locations on the
 * same spot. Hover or keyboard focus shows a short tooltip; click or Enter opens the popup.
 */
/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): pin markup. */
export function LocationPin({ cluster, expanded, onOpen }: Props) {
  const { t } = useTranslation();
  const [only, ...rest] = cluster.locations;
  if (!only) return null;
  const isCluster = rest.length > 0;
  const open = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpen(cluster.key, event.currentTarget);
  };
  const label = pinLabel(cluster, t);
  return (
    <span className={styles.pinWrap}>
      <button
        type="button"
        className={isCluster ? styles.pinCluster : styles.pin}
        data-shape={isCluster ? undefined : PIN_SHAPE[only.kind]}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={open}
      >
        {isCluster ? (
          <>
            <Layers aria-hidden="true" />
            <span className={styles.pinCount}>{cluster.locations.length}</span>
          </>
        ) : (
          <span className={styles.pinIcon}>
            <KindIcon kind={only.kind} />
          </span>
        )}
      </button>
      <span className={styles.pinTip} aria-hidden="true">
        {isCluster ? label : `${only.code} · ${only.name}`}
      </span>
    </span>
  );
}
