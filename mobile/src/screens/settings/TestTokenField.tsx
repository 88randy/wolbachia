import { spacing } from "@wolbachia/tokens";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useServices } from "../../app/services-context.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { TextField } from "../../ui/TextField.tsx";

const styles = StyleSheet.create({ field: { gap: spacing[1] } });

/** Where a test access token is pasted. It stays in memory: nothing writes it to disk. */
export function TestTokenField() {
  const t = useT();
  const { tokens } = useServices();
  const [token, setToken] = useState("");
  const trimmed = token.trim();
  return (
    <View style={styles.field}>
      <TextField
        label={t("mobile.dev.tokenLabel")}
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Button
        variant="outline"
        label={t("mobile.dev.tokenUse")}
        onPress={() => {
          tokens.setAccessToken(trimmed === "" ? undefined : trimmed);
        }}
      />
    </View>
  );
}
