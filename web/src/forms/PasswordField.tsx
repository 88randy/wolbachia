import { Eye } from "lucide-react";
import { useState } from "react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import styles from "./form.module.css";
import { TextField } from "./TextField";

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, "type" | "trailing">;

/**
 * A password input with a show/hide button. The button keeps one name and exposes its state with
 * `aria-pressed`, so screen readers do not hear a different label each time.
 */
export function PasswordField(props: PasswordFieldProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={isVisible ? "text" : "password"}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={isVisible}
          aria-label={t("auth.login.showPassword")}
          onClick={() => {
            setIsVisible((visible) => !visible);
          }}
        >
          <Eye aria-hidden="true" className={styles.icon} />
        </button>
      }
    />
  );
}
