import { HubCard } from "./HubCard";
import type { HubCardItem } from "./HubCard";

/** Responsive grid of icon cards; callers pass only the items the user may open. */
export function HubGrid({ items, label }: { items: readonly HubCardItem[]; label: string }) {
  return (
    <ul
      aria-label={label}
      className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4 p-0"
    >
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <HubCard item={item} />
        </li>
      ))}
    </ul>
  );
}
