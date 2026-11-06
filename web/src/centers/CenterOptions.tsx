import { useTranslation } from "react-i18next";
import type { CenterSelectorController } from "./use-center-selector";
export function CenterOptions({ selector }: { selector: CenterSelectorController }) {
  const { t } = useTranslation();
  return (
    <select
      id="active-center"
      value={selector.selected}
      disabled={selector.query.isPending || selector.query.isError}
      onChange={(event) => {
        selector.select(event.target.value);
      }}
    >
      <option value="" disabled={!selector.isAll}>
        {t(selector.isAll ? "orgAdmin.center.all" : "orgAdmin.center.choose")}
      </option>
      {selector.centers.map((center) => (
        <option key={center.id} value={center.id}>
          {center.code} · {center.name}
        </option>
      ))}
    </select>
  );
}
