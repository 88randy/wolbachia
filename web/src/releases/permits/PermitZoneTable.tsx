import { useTranslation } from "react-i18next";
import { useLanguage } from "../../i18n/use-language";
import { outerVertices } from "./permit-geometry";
import { PermitZoneHead } from "./PermitZoneHead";
import styles from "./permits.module.css";

/** Table alternative of the zone: the official polygon's vertices (a map would draw the same). */
export function PermitZoneTable({ geometry }: { geometry: unknown }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const vertices = outerVertices(geometry);
  const format = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 6 }).format(value);
  if (vertices.length === 0) return <p>{t("permits.zone.none")}</p>;
  return (
    <table className={styles.table}>
      <caption className={styles.srOnly}>{t("permits.zone.caption")}</caption>
      <PermitZoneHead />
      <tbody>
        {vertices.map(([lng, lat], index) => (
          <tr key={`${String(lng)}:${String(lat)}:${String(index)}`}>
            <th scope="row">{index + 1}</th>
            <td className={styles.number}>{format(lng)}</td>
            <td className={styles.number}>{format(lat)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
