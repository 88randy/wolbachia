import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../components/templates/ListPage";
import { useCan } from "../session/use-can";
import { ActivitiesTable } from "./ActivitiesTable";
import { ActivityVoidDialog } from "./ActivityVoidDialog";
import { COMMUNITY_CREATE } from "./community-query";
import type { CommunityActivity } from "./community-query";
import { NewActivityDialog } from "./NewActivityDialog";

/**
 * W52, community activities: talks, meetings and notices with their zone, attendance and
 * agreements, and the complaint each one is linked to. Neighbor names and phones do not exist
 * here. Nothing is deleted: a mistake is voided with a reason.
 */
export function W52Page() {
  const { t } = useTranslation();
  const canCreate = useCan()(COMMUNITY_CREATE);
  const [voiding, setVoiding] = useState<CommunityActivity>();
  return (
    <ListPage title={t("community.title")} actions={<NewActivityDialog canCreate={canCreate} />}>
      <ActivitiesTable onVoid={setVoiding} />
      {voiding !== undefined && (
        <ActivityVoidDialog
          activity={voiding}
          onClose={() => {
            setVoiding(undefined);
          }}
        />
      )}
    </ListPage>
  );
}
