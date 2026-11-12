import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import type { Schemas } from "@wolbachia/api-client";
import { zoneFromQuadrants } from "./zone-from-quadrants";
import type { PolygonBody } from "./permit-geometry";

interface Props {
  quadrants: readonly Schemas["QuadrantLookup"][];
  selected: readonly string[];
  onSelect: (ids: string[], zone: PolygonBody | null) => void;
}

/** "Elegir cuadrantes": tick the quadrants and the zone is built from their outlines. */
export function ZoneQuadrantPicker({ quadrants, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const toggle = (id: string, checked: boolean) => {
    const next = checked ? [...selected, id] : selected.filter((item) => item !== id);
    const rings = quadrants
      .filter((item) => next.includes(item.id))
      .flatMap((item) => item.current_version?.geometry.coordinates[0] ?? []);
    const outlines = quadrants
      .filter((item) => next.includes(item.id))
      .map((item) => item.current_version?.geometry.coordinates[0] ?? []);
    onSelect(next, rings.length === 0 ? null : zoneFromQuadrants(outlines));
  };
  return (
    <fieldset className="m-0 flex max-h-56 flex-col gap-2 overflow-auto border-0 p-0">
      <legend className="sr-only">{t("permits.zone.pickQuadrants")}</legend>
      {quadrants.map((item) => (
        <label key={item.id} className="flex items-center gap-2 text-sm text-ink">
          <Checkbox
            checked={selected.includes(item.id)}
            onCheckedChange={(checked) => {
              toggle(item.id, checked === true);
            }}
          />
          {item.code}
        </label>
      ))}
    </fieldset>
  );
}
