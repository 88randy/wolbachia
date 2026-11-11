import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";
import { useCan } from "../session/use-can";
import { Button } from "../ui/Button";
import { NewUserDialog } from "./NewUserDialog";

/** Creating a login also assigns its profile, so both permissions are needed; otherwise hidden. */
export function NewUserButton() {
  const { t } = useTranslation();
  const can = useCan();
  const [isOpen, setOpen] = useState(false);
  if (!can("user.create") || !can("role.update")) return null;
  return (
    <>
      <Button
        leadingIcon={<UserPlus aria-hidden="true" />}
        onClick={() => {
          setOpen(true);
        }}
      >
        {t("users.new.action")}
      </Button>
      {isOpen && (
        <NewUserDialog
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
