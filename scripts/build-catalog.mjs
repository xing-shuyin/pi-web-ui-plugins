#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listAllPlugins } from "./lib/pr-changes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const DIST_DIR = resolve(ROOT_DIR, "dist");
const OUT_FILE = resolve(DIST_DIR, "catalog.json");

function buildCatalog() {
  console.log("📦 Building pi-web-ui plugin catalog...");

  const pluginIds = listAllPlugins().sort();
  const entries = [];

  for (const id of pluginIds) {
    const file = resolve(ROOT_DIR, `plugins/${id}/plugin.json`);
    if (!existsSync(file)) continue;

    try {
      const data = JSON.parse(readFileSync(file, "utf8"));
      // 保证字段与 pi-web-ui 的 UiPluginCatalogEntry 规范完全一致
      const entry = {
        id: data.id,
        name: data.name || data.id,
        source: data.source,
        ...(data.description ? { description: data.description } : {}),
        ...(data.descriptionEn ? { descriptionEn: data.descriptionEn } : {}),
        ...(data.icon ? { icon: data.icon } : {}),
        ...(data.iconSvg ? { iconSvg: data.iconSvg } : {}),
        ...(data.homepage ? { homepage: data.homepage } : {}),
      };
      entries.push(entry);
    } catch (err) {
      console.error(`⚠️ Failed to parse plugins/${id}/plugin.json:`, err.message);
    }
  }

  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  const jsonText = JSON.stringify(entries, null, 2) + "\n";
  writeFileSync(OUT_FILE, jsonText, "utf8");

  console.log(`✅ Successfully built catalog with ${entries.length} plugins.`);
  console.log(`📁 Output: ${OUT_FILE}`);
}

buildCatalog();
