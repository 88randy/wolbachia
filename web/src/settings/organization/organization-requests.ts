import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { SessionGuard } from "../../session/use-session-guard";
import { organizationBody, prepareLogo } from "./branding";
import type { Organization } from "./use-w-03";
interface Context {
  client: ApiClient;
  guard: SessionGuard;
  settings: Organization;
}
export async function requestOrganizationChange({ client, guard, settings }: Context) {
  const result = unwrap(
    await client.PATCH("/api/v1/organization/", {
      body: organizationBody(settings),
      signal: guard.signal,
    }),
  );
  return { result, guard };
}
export async function requestLogoUpload(context: Context, file: File) {
  const png = await prepareLogo(file);
  if (context.guard.isStale()) return undefined;
  const body = { expected_revision: context.settings.revision, logo: png.name };
  return unwrap(
    await context.client.POST("/api/v1/organization/logo/", {
      body,
      signal: context.guard.signal,
      bodySerializer: () => {
        const form = new FormData();
        form.set("expected_revision", String(body.expected_revision));
        form.set("logo", png);
        return form;
      },
    }),
  );
}
