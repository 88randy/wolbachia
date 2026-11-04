export {
  createApiClient,
  CSRF_HEADER,
  ORGANIZATION_HEADER,
  type ApiAuth,
  type ApiClient,
  type ApiClientOptions,
} from "./client.ts";
export {
  ApiError,
  isErrorEnvelope,
  unwrap,
  UNKNOWN_ERROR_CODE,
  type ErrorEnvelope,
} from "./errors.ts";
export type { components, operations, paths } from "./generated/schema.ts";

import type { components } from "./generated/schema.ts";

/** Every schema of the API by name: `Schemas["Me"]`. */
export type Schemas = components["schemas"];
