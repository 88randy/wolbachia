import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Button } from "../../ui/Button";
import type { GeographyScope } from "./use-w-15";
import { BlockSuggestions } from "./BlockSuggestions";
import { BlockCreateForm } from "./BlockCreateForm";

interface Props {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
}
/** Block actions: a compact button row, the forms open below it. */
export function BlockTools({ scope, quadrant }: Props) {
  const { t } = useTranslation();
  const [isSuggesting, setSuggesting] = useState(false);
  const [isCreating, setCreating] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setSuggesting(true);
          }}
        >
          {t("geography.blocks.suggest")}
        </Button>
        {scope.canPublish && (
          <Button
            variant="secondary"
            onClick={() => {
              setCreating(true);
            }}
          >
            {t("geography.blocks.create")}
          </Button>
        )}
      </div>
      {isSuggesting && <BlockSuggestions scope={scope} quadrant={quadrant.id} />}
      {isCreating && <BlockCreateForm scope={scope} quadrant={quadrant.id} />}
    </div>
  );
}
