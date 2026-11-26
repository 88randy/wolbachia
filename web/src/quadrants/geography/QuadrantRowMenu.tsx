import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CardMenu } from "../../ui/CardMenu";

interface Props {
  code: string;
  canEdit: boolean;
  canClose: boolean;
}

/** Row actions of the quadrant list, in one "⋯" menu. */
export function QuadrantRowMenu({ code, canEdit, canClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = () => void navigate({ to: "/quadrants/$code/versions", params: { code } });
  const items = [
    { label: t("mapEditor.action.openRecord"), onSelect: open },
    ...(canEdit ? [{ label: t("mapEditor.action.editOnMap"), onSelect: open }] : []),
    ...(canClose
      ? [
          {
            label: t("closure.actions.close"),
            onSelect: () => void navigate({ to: "/quadrants/$code/closure", params: { code } }),
          },
        ]
      : []),
  ];
  return <CardMenu label={t("ui.actions.more")} items={items} />;
}
