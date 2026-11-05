import type { TypeGroup } from "../../outbox/outbox-event.ts";
import { GroupCard } from "./GroupCard.tsx";
import { InboxSection } from "./InboxSection.tsx";

/** A titled list of event groups; renders nothing when there are none. */
export function GroupSection({
  title,
  groups,
}: {
  readonly title: string;
  readonly groups: readonly TypeGroup[];
}) {
  if (groups.length === 0) return null;
  return (
    <InboxSection title={title}>
      {groups.map((group) => (
        <GroupCard key={`${group.type}:${group.status}`} group={group} />
      ))}
    </InboxSection>
  );
}
