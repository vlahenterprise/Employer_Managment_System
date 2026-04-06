import { config } from "./config";

export function isHrModuleEnabled() {
  return config.features.hrModuleEnabled;
}
