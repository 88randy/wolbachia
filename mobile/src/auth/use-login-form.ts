import { useState, useSyncExternalStore } from "react";

import { useServices } from "../app/services-context.ts";
import { useAuthAction } from "./use-auth-action.ts";
import { useServerProvisioning } from "./use-server-provisioning.ts";

export function useLoginForm() {
  const { auth, tokens } = useServices();
  const isFinalUploadPending = useSyncExternalStore(tokens.subscribe, tokens.hasSyncSession);
  const fields = useLoginFields(auth.getSnapshot().profile?.username ?? "");
  const panels = useLoginPanels();
  const canConfigureServer = useServerProvisioning();
  const isCleanupRetry = auth.getSnapshot().notice?.key === "mobile.login.cleanupFailed";
  const action = useAuthAction();
  const submit = () => {
    action.run(async () => {
      try {
        await auth.login(fields.username, fields.password);
      } finally {
        fields.setPassword("");
      }
    });
  };
  return {
    ...fields,
    ...panels,
    ...action,
    canConfigureServer,
    isBusy: action.isBusy || (isFinalUploadPending && !isCleanupRetry),
    isCleanupRetry,
    retryCleanup: () => {
      action.run(auth.retrySessionDataCleanup);
    },
    submit,
  };
}

function useLoginFields(initialUsername: string) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  return {
    username,
    setUsername,
    password,
    setPassword,
    isPasswordVisible,
    togglePassword: () => {
      setIsPasswordVisible((visible) => !visible);
    },
  };
}

function useLoginPanels() {
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isServerOpen, setIsServerOpen] = useState(false);
  return {
    isForgotOpen,
    isServerOpen,
    openForgot: () => {
      setIsForgotOpen(true);
    },
    closeForgot: () => {
      setIsForgotOpen(false);
    },
    toggleServer: () => {
      setIsServerOpen((open) => !open);
    },
  };
}
