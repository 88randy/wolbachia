import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { GeographyScope } from "./use-w-15";
import { BlockSuggestions } from "./BlockSuggestions";
import { BlockCreateForm } from "./BlockCreateForm";
import styles from "./geography.module.css";
interface Props {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
}
export function BlockTools({ scope, quadrant }: Props) {
  const { t } = useTranslation();
  const [isSuggesting, setSuggesting] = useState(false);
  const [isCreating, setCreating] = useState(false);
  return (
    <div className={styles.content}>
      <button
        type="button"
        onClick={() => {
          setSuggesting(true);
        }}
      >
        {t("geography.blocks.suggest")}
      </button>
      {scope.canPublish && (
        <button
          type="button"
          onClick={() => {
            setCreating(true);
          }}
        >
          {t("geography.blocks.create")}
        </button>
      )}
      {isSuggesting && <BlockSuggestions scope={scope} quadrant={quadrant.id} />}
      {isCreating && <BlockCreateForm scope={scope} quadrant={quadrant.id} />}
    </div>
  );
}
