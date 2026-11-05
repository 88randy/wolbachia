import { createContext, useContext } from "react";

import type { AppServices } from "./create-services.ts";

export const ServicesContext = createContext<AppServices | null>(null);

/** The shared services. Only valid below the bootstrap, which renders nothing until they exist. */
export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (services === null) throw new Error("useServices was called before the app finished booting.");
  return services;
}
