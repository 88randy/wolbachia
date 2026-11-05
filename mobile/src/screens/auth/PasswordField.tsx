import type { TextInputProps } from "react-native";
import { View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { createAuthStyles } from "./auth-styles.ts";

const PASSWORD_INPUT_OPTIONS = {
  autoComplete: "off",
  autoCapitalize: "none",
  autoCorrect: false,
  spellCheck: false,
} as const;

interface PasswordFieldProps {
  readonly password: string;
  readonly setPassword: (value: string) => void;
  readonly isBusy: boolean;
  readonly hasError?: boolean;
  readonly isPasswordVisible?: boolean;
  readonly togglePassword?: () => void;
}
export function PasswordField(props: PasswordFieldProps) {
  const t = useT();
  const styles = useStyles(createAuthStyles);
  const inputProps: TextInputProps = {
    value: props.password,
    onChangeText: props.setPassword,
    secureTextEntry: !props.isPasswordVisible,
    editable: !props.isBusy,
    ...PASSWORD_INPUT_OPTIONS,
    style: styles.passwordInput,
  };
  return (
    <View style={styles.field}>
      <AppText variant="label">{t("mobile.login.password")}</AppText>
      <View style={[styles.passwordFrame, props.hasError && styles.invalidField]}>
        <TextField label={t("mobile.login.password")} {...inputProps} />
        {props.togglePassword !== undefined ? (
          <Button
            variant="text"
            label={t(
              props.isPasswordVisible ? "mobile.login.hidePassword" : "mobile.login.showPassword",
            )}
            onPress={props.togglePassword}
          />
        ) : null}
      </View>
    </View>
  );
}
