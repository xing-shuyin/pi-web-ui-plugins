#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listAllPlugins } from "./lib/pr-changes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const DIST_DIR = resolve(ROOT_DIR, "dist");
const OUT_JSON = resolve(DIST_DIR, "catalog.json");
const OUT_HTML = resolve(DIST_DIR, "index.html");

function buildCatalog() {
  console.log("📦 Building pi-web-ui plugin catalog...");

  const pluginIds = listAllPlugins().sort();
  const entries = [];

  for (const id of pluginIds) {
    const file = resolve(ROOT_DIR, `plugins/${id}/plugin.json`);
    if (!existsSync(file)) continue;

    try {
      const data = JSON.parse(readFileSync(file, "utf8"));
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

  // 1. 写 catalog.json
  const jsonText = JSON.stringify(entries, null, 2) + "\n";
  writeFileSync(OUT_JSON, jsonText, "utf8");

  // 2. 写 index.html 网页预览
  const htmlText = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>pi-web-ui Plugin Registry</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #0f172a; color: #f8fafc; line-height: 1.6; }
    h1 { font-size: 2rem; border-bottom: 1px solid #334155; padding-bottom: 16px; }
    .badge { background: #3b82f6; color: white; padding: 3px 8px; border-radius: 9999px; font-size: 0.85rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin-top: 24px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; }
    .card-header { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 1.1rem; }
    .card-desc { font-size: 0.9rem; color: #94a3b8; margin: 12px 0; flex-grow: 1; }
    .card-source { font-size: 0.8rem; color: #64748b; word-break: break-all; }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 40px; font-size: 0.85rem; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>🧩 pi-web-ui 插件清单市场 <span class="badge">${entries.length} 个插件</span></h1>
  <p>订阅地址：<a href="catalog.json"><code>catalog.json</code></a></p>
  <div class="grid">
    ${entries
      .map(
        (e) => `
      <div class="card">
        <div class="card-header">
          <span>${e.icon || "📦"}</span>
          <span>${e.name}</span>
        </div>
        <div class="card-desc">${e.description || e.descriptionEn || "暂无描述"}</div>
        <div class="card-source">
          来源: <a href="${e.homepage || `https://github.com/${e.source.split("#")[0]}`}" target="_blank">${e.source}</a>
        </div>
      </div>
    `
      )
      .join("")}
  </div>
  <div class="footer">
    由 <a href="https://github.com/xing-shuyin/pi-web-ui-plugins" target="_blank">pi-web-ui-plugins</a> 自动构建生成
  </div>
</body>
</html>`;
  writeFileSync(OUT_HTML, htmlText, "utf8");

  console.log(`✅ Successfully built catalog with ${entries.length} plugins.`);
  console.log(`📁 Output: ${OUT_JSON}, ${OUT_HTML}`);
}

buildCatalog();
