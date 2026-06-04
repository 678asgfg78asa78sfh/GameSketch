import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { configPath, dataDir } from "./storage/paths.js";

function defaults() {
  return {
    users: [],
    session_secret: randomBytes(32).toString("hex"),
    ai: { baseUrl: "", model: "", apiKey: "" },
  };
}

export function loadConfig() {
  if (!existsSync(configPath())) {
    mkdirSync(dataDir(), { recursive: true });
    const c = defaults();
    writeFileSync(configPath(), JSON.stringify(c, null, 2));
    return c;
  }
  return { ...defaults(), ...JSON.parse(readFileSync(configPath(), "utf8")) };
}

export function saveConfig(c) {
  mkdirSync(dirname(configPath()), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(c, null, 2));
}
