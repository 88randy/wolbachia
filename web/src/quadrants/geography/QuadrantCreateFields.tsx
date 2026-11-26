/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { useApiClient } from "../../api/ApiClientProvider";
import { centersOptions } from "../../centers/centers-query";
import { useSessionIdentity } from "../../session/use-session-identity";
import { SelectMenu } from "../../ui/SelectMenu";
import { MapPolygonPicker } from "../../map-picker/MapPolygonPicker";
import { parsePolygon, polygonText } from "./geometry";
import type { CreateQuadrant } from "./use-create-quadrant";
import styles from "./geography.module.css";
/** Name, center picker and the shape drawn on the map; nothing is typed as coordinates. */
export function QuadrantCreateFields({ form }: { form: CreateQuadrant }) {
  const { t } = useTranslation();
  const id = useId();
  const centers = useQuery(centersOptions(useApiClient(), useSessionIdentity()));
  return (
    <fieldset disabled={form.write.isBusy} className={styles.fieldset}>
      <TextField
        id={id + "-code"}
        label={t("geography.field.code")}
        value={form.code}
        required
        onChange={(event) => {
          form.setCode(event.target.value);
        }}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id + "-center"} className="text-[13px] font-semibold text-ink">
          {t("mapEditor.field.center")}
        </label>
        <SelectMenu
          id={id + "-center"}
          value={form.center}
          placeholder={t("mapEditor.field.centerPlaceholder")}
          options={(centers.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
          onValueChange={form.setCenter}
        />
      </div>
      <MapPolygonPicker
        label={t("geography.field.polygon")}
        value={parsePolygon(form.text)}
        onChange={(polygon) => {
          form.setText(polygonText(polygon));
        }}
      />
    </fieldset>
  );
}
