import { useTranslation } from "react-i18next";
import { Skeleton } from "./Skeleton";
import styles from "./ui.module.css";
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("states.loading.label")} className={styles.tableSkeleton}>
      <table aria-hidden="true">
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, column) => (
                <td key={column}>
                  <Skeleton />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
