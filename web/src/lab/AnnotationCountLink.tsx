import { useNavigate, useSearch } from "@tanstack/react-router";
import { Image } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
export function AnnotationCountLink({ code, isLocked }: { code: string; isLocked: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(search))
    if (typeof value === "string") parameters[key] = value;
  return !isLocked ? (
    <Button
      variant="secondary"
      leadingIcon={<Image aria-hidden="true" />}
      data-count-alternative="photo"
      onPointerDown={(event) => {
        // Keep the numeric field stable until click, including browsers that do not focus buttons.
        event.preventDefault();
      }}
      onClick={() => {
        void navigate({
          to: "/lab/egg-counts/$bagCode/annotate",
          params: { bagCode: code },
          search: parameters,
        });
      }}
    >
      {t("labAnnotation.editor.action")}
    </Button>
  ) : null;
}
