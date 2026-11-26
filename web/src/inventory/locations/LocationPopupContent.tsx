import type { ReactNode } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { KindIcon } from "./LocationPin";
import type { Location, LocationCluster } from "./location-pins";
import { pointOf } from "./location-pins";
import styles from "../inventory.module.css";

interface Props {
  cluster: LocationCluster;
  /** Renders the center NAME for an id (the popup never shows ids). */
  centerName: (centerId: string) => ReactNode;
  onClose: () => void;
}

function safetyKey(location: Location): MessageKey {
  if (location.is_insecticide_free === null) return "inventory.state.unconfigured";
  return location.is_insecticide_free ? "inventory.option.yes" : "inventory.option.no";
}

function RecordLink({ location, children }: { location: Location; children: ReactNode }) {
  return (
    <Link
      className={styles.popupLink}
      to="/inventory/locations/$code"
      params={{ code: location.code }}
      search={{ center: location.center }}
    >
      {children}
    </Link>
  );
}

function detailRows(
  location: Location,
  centerName: Props["centerName"],
  t: TFunction,
): [MessageKey, ReactNode][] {
  const { lng, lat } = pointOf(location);
  return [
    ["inventory.field.code", location.code],
    ["inventory.field.name", location.name],
    ["inventory.field.center", centerName(location.center)],
    ["inventory.field.kind", t(`inventory.option.${location.kind}`)],
    ["inventory.field.owner", location.owner_label],
    ["inventory.field.isInsecticideFree", t(safetyKey(location))],
    ["inventory.map.coordinates", `${String(lng)}, ${String(lat)}`],
  ];
}

function Details({
  location,
  centerName,
}: {
  location: Location;
  centerName: Props["centerName"];
}) {
  const { t } = useTranslation();
  const rows = detailRows(location, centerName, t);
  return (
    <>
      <dl className={styles.popupDetails}>
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <RecordLink location={location}>{t("inventory.map.openRecord")}</RecordLink>
    </>
  );
}

function ClusterList({ cluster }: { cluster: LocationCluster }) {
  const { t } = useTranslation();
  return (
    <>
      <p className={styles.popupTitle}>
        {t("inventory.map.clusterTitle", { count: cluster.locations.length })}
      </p>
      <ul className={styles.popupList}>
        {cluster.locations.map((location) => (
          <li key={location.id}>
            <RecordLink location={location}>
              <KindIcon kind={location.kind} />
              <span>
                {location.code} · {location.name}
              </span>
            </RecordLink>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Popup body: the full details of one location, or the list of every location on one spot. */
export function LocationPopupContent({ cluster, centerName, onClose }: Props) {
  const { t } = useTranslation();
  const [only, ...rest] = cluster.locations;
  if (!only) return null;
  return (
    <section className={styles.popup} aria-label={t("inventory.map.popupLabel")}>
      <button
        type="button"
        className={styles.popupClose}
        aria-label={t("inventory.map.close")}
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>
      {rest.length > 0 ? (
        <ClusterList cluster={cluster} />
      ) : (
        <Details location={only} centerName={centerName} />
      )}
    </section>
  );
}
