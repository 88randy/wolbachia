import { Link } from "@tanstack/react-router";
import { LogOut, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ServiceFailureAlert } from "../forms/ServiceFailureAlert";
import { useMe } from "../session/use-me";
import type { useSignOut } from "../session/use-sign-out";
import styles from "./UserMenu.module.css";
import { UserMenuDetails } from "./UserMenuDetails";

const MIN_ORGANIZATIONS_TO_CHOOSE = 2;

/** Who is signed in, and the two things they can do about it. */
export function UserMenuPanel({
  id,
  signOut,
}: {
  id: string;
  signOut: ReturnType<typeof useSignOut>;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const canChangeOrganization = me.organizations.length >= MIN_ORGANIZATIONS_TO_CHOOSE;
  return (
    <div id={id} className={styles.panel}>
      <UserMenuDetails />
      <ServiceFailureAlert id="sign-out-alert" failure={signOut.failure} />
      {canChangeOrganization && (
        <Link to="/select-organization" className={styles.item}>
          <Repeat aria-hidden="true" className={styles.itemIcon} />
          {t("shell.userMenu.changeOrganization")}
        </Link>
      )}
      <SignOutItem signOut={signOut} />
    </div>
  );
}

function SignOutItem({ signOut: { signOut, isBusy } }: { signOut: ReturnType<typeof useSignOut> }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.item}
      aria-disabled={isBusy}
      onClick={() => {
        if (!isBusy) void signOut();
      }}
    >
      <LogOut aria-hidden="true" className={styles.itemIcon} />
      {t("shell.userMenu.signOut")}
    </button>
  );
}
