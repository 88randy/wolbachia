import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { SearchGroup } from "./discovery-query";
import { SearchHitRow } from "./SearchHitRow";

interface SearchGroupCardProps {
  group: SearchGroup;
  /** Set when the card shows only a preview: offers "view all". */
  onShowAll?: () => void;
}

/** The hits of one record type, with their total. */
export function SearchGroupCard({ group, onShowAll }: SearchGroupCardProps) {
  const { t } = useTranslation();
  const hasMore = onShowAll !== undefined && group.count > group.hits.length;
  return (
    <Card title={`${t(`discovery.type.${group.type}`)} · ${String(group.count)}`} headingLevel={2}>
      <ul className="m-0 flex list-none flex-col p-0">
        {group.hits.map((hit) => (
          <SearchHitRow key={hit.id} hit={hit} />
        ))}
      </ul>
      {hasMore && (
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={onShowAll}>
            {t("discovery.search.showAll", { count: group.count })}
          </Button>
        </div>
      )}
    </Card>
  );
}
