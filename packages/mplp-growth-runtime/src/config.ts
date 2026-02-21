import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface SystemConfig {
  hn_keywords: string[];
}

const DEFAULT_CONFIG: SystemConfig = {
  hn_keywords: ["opensource", "mplp", "openclaw"],
};

export function loadConfig(stateDir?: string): SystemConfig {
  const config = { ...DEFAULT_CONFIG };

  // 1. File config
  const basePath =
    stateDir ||
    process.env.MPLP_GROWTH_STATE_DIR ||
    path.join(os.homedir(), ".openclaw", "mplp-growth");
  const configPath = path.join(basePath, "config.json");

  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, "utf-8");
      const fileConfig = JSON.parse(fileContent);
      if (Array.isArray(fileConfig.hn_keywords) && fileConfig.hn_keywords.length > 0) {
        config.hn_keywords = fileConfig.hn_keywords;
      }
    }
  } catch (e) {
    console.warn(`[Config] Failed to load config.json at ${configPath}:`, e);
  }

  // 2. ENV override (highest priority)
  if (process.env.HN_KEYWORDS) {
    const envKeywords = process.env.HN_KEYWORDS.split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (envKeywords.length > 0) {
      config.hn_keywords = envKeywords;
    }
  }

  return config;
}
