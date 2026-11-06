import type { ApiClient } from "@wolbachia/api-client";
import type { CredentialStore } from "../auth/credential-store.ts";
import type { TokenStore } from "../auth/token-store.ts";
import { createMobileApiClient } from "./create-api-client.ts";
import type { MobileApiClientOptions } from "./create-api-client.ts";

interface Options {
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly fetch?: MobileApiClientOptions["fetch"];
}
/** A queued request cannot adopt a replacement account on the same issuer. Token rotation is valid. */
export function createScopedApiClient(options: Options): ApiClient {
  const session = options.tokens.getSnapshot();
  const client = createMobileApiClient({
    ...options,
    baseUrl: options.tokens.getOrigin() ?? "",
  });
  client.use({
    onRequest: ({ request }) => {
      const current = options.tokens.getSnapshot();
      if (current.sessionId !== session.sessionId || current.origin !== session.origin)
        throw new Error("Request session changed before sending.");
      return request;
    },
  });
  return client;
}
