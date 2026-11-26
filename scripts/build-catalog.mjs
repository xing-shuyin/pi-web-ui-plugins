#!/usr/bin/env node
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listAllPlugins, listAllThemes } from "./lib/pr-changes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const DIST_DIR = resolve(ROOT_DIR, "dist");
const OUT_PLUGINS_JSON = resolve(DIST_DIR, "catalog.json");
const OUT_THEMES_JSON = resolve(DIST_DIR, "themes.json");
const OUT_HTML = resolve(DIST_DIR, "index.html");

function buildCatalog() {
  console.log("📦 Building pi-web-ui registry catalog (plugins & themes)...");

  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  // 1. 构建插件清单
  const pluginIds = listAllPlugins().sort();
  const pluginEntries = [];

  for (const id of pluginIds) {
    const file = resolve(ROOT_DIR, `plugins/${id}/plugin.json`);
    if (!existsSync(file)) continue;

    try {
      const data = JSON.parse(readFileSync(file, "utf8"));
      const entry = {
        id: data.id,
        name: data.name || data.id,
        ...(data.nameEn ? { nameEn: data.nameEn } : {}),
        source: data.source,
        ...(data.description ? { description: data.description } : {}),
        ...(data.descriptionEn ? { descriptionEn: data.descriptionEn } : {}),
        ...(data.icon ? { icon: data.icon } : {}),
        ...(data.iconSvg ? { iconSvg: data.iconSvg } : {}),
        ...(data.homepage ? { homepage: data.homepage } : {}),
        ...(data.tags ? { tags: data.tags } : {}),
      };
      pluginEntries.push(entry);
    } catch (err) {
      console.error(
        `⚠️ Failed to parse plugins/${id}/plugin.json:`,
        err.message,
      );
    }
  }

  // 2. 构建主题清单与静态资源物化
  const themeIds = listAllThemes().sort();
  const themeEntries = [];

  for (const id of themeIds) {
    const jsonFile = resolve(ROOT_DIR, `themes/${id}/theme.json`);
    const cssFile = resolve(ROOT_DIR, `themes/${id}/theme.css`);
    if (!existsSync(jsonFile)) continue;

    try {
      const data = JSON.parse(readFileSync(jsonFile, "utf8"));

      let cssRelativeUrl = null;
      if (existsSync(cssFile)) {
        const destThemeDir = resolve(DIST_DIR, `themes/${id}`);
        if (!existsSync(destThemeDir)) {
          mkdirSync(destThemeDir, { recursive: true });
        }
        copyFileSync(cssFile, resolve(destThemeDir, "theme.css"));
        cssRelativeUrl = `themes/${id}/theme.css`;
      }

      const entry = {
        id: data.id,
        name: data.name || data.id,
        ...(data.nameEn ? { nameEn: data.nameEn } : {}),
        author: data.author,
        scheme: data.scheme || "dark",
        ...(data.group ? { group: data.group } : {}),
        description: data.description || "",
        ...(data.descriptionEn ? { descriptionEn: data.descriptionEn } : {}),
        palette: data.palette || {},
        ...(cssRelativeUrl ? { cssUrl: cssRelativeUrl } : {}),
        ...(data.source ? { source: data.source } : {}),
        ...(data.homepage ? { homepage: data.homepage } : {}),
        ...(data.tags ? { tags: data.tags } : {}),
      };
      themeEntries.push(entry);
    } catch (err) {
      console.error(`⚠️ Failed to parse themes/${id}/theme.json:`, err.message);
    }
  }

  // 写入 JSON 产物
  writeFileSync(
    OUT_PLUGINS_JSON,
    JSON.stringify(pluginEntries, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    OUT_THEMES_JSON,
    JSON.stringify(themeEntries, null, 2) + "\n",
    "utf8",
  );

  // 3. 构建聚合预览网页 index.html
  const htmlText = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>pi-web-ui 社区生态市场 (Plugins & Themes)</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-dim: #94a3b8;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 40px auto; padding: 0 20px; background: var(--bg); color: var(--text); line-height: 1.6; }
    h1 { font-size: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .badge { background: var(--accent); color: white; padding: 3px 10px; border-radius: 9999px; font-size: 0.85rem; font-weight: normal; }
    .badge-sub { background: #475569; color: #e2e8f0; font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; }
    
    .nav-tabs { display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid var(--border); }
    .nav-tab { padding: 10px 18px; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 600; color: var(--text-dim); transition: all 0.2s; user-select: none; }
    .nav-tab:hover { color: var(--text); }
    .nav-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

    .sub-bar { background: #1e293b; border: 1px solid var(--border); padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 0.9rem; }
    .sub-bar code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #38bdf8; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; }
    .card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 600; font-size: 1.1rem; }
    .card-title-left { display: flex; align-items: center; gap: 8px; }
    .card-desc { font-size: 0.9rem; color: var(--text-dim); margin: 12px 0; flex-grow: 1; }
    .card-footer { font-size: 0.8rem; color: #64748b; margin-top: auto; padding-top: 10px; border-top: 1px solid #293548; display: flex; justify-content: space-between; align-items: center; }
    
    .swatches { display: flex; gap: 6px; margin: 8px 0 12px; }
    .swatch { width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); }

    a { color: var(--accent-hover); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 50px; font-size: 0.85rem; color: #64748b; border-top: 1px solid var(--border); padding-top: 20px; text-align: center; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
  <h1>
    <span>🌐 pi-web-ui 社区生态市场</span>
    <div>
      <span class="badge">${pluginEntries.length} 插件</span>
      <span class="badge" style="background:#8b5cf6;">${themeEntries.length} 主题</span>
    </div>
  </h1>

  <div class="nav-tabs">
    <div class="nav-tab active" onclick="switchTab('plugins')">🧩 社区插件 (${pluginEntries.length})</div>
    <div class="nav-tab" onclick="switchTab('themes')">🎨 视觉主题 (${themeEntries.length})</div>
  </div>

  <div id="tab-plugins" class="tab-content active">
    <div class="sub-bar">
      📦 插件清单订阅：<a href="catalog.json"><code>catalog.json</code></a>
    </div>
    <div class="grid">
      ${pluginEntries
        .map(
          (e) => `
        <div class="card">
          <div class="card-header">
            <div class="card-title-left">
              <span>${e.icon || "📦"}</span>
              <span>${e.name}</span>
            </div>
          </div>
          <div class="card-desc">${e.description || e.descriptionEn || "暂无描述"}</div>
          <div class="card-footer">
            <span>来源: <a href="${e.homepage || `https://github.com/${e.source.split("#")[0]}`}" target="_blank">${e.source}</a></span>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  </div>

  <div id="tab-themes" class="tab-content">
    <div class="sub-bar">
      🎨 主题清单订阅：<a href="themes.json"><code>themes.json</code></a>
    </div>
    <div class="grid">
      ${themeEntries
        .map(
          (t) => `
        <div class="card">
          <div class="card-header">
            <div class="card-title-left">
              <span>🎨</span>
              <span>${t.name}</span>
            </div>
            <span class="badge-sub">${t.scheme.toUpperCase()}</span>
          </div>
          <div class="card-desc">${t.description || t.descriptionEn || "暂无描述"}</div>
          ${
            t.palette?.swatches || t.palette?.bg
              ? `
          <div class="swatches" title="主题调色盘">
            ${(
              t.palette.swatches || [
                t.palette.bg,
                t.palette.accent,
                t.palette.text,
              ]
            )
              .map(
                (c) =>
                  `<div class="swatch" style="background-color: ${c};" title="${c}"></div>`,
              )
              .join("")}
          </div>`
              : ""
          }
          <div class="card-footer">
            <span>作者: @${t.author}</span>
            ${t.cssUrl ? `<a href="${t.cssUrl}" target="_blank">查看 CSS</a>` : ""}
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  </div>

  <div class="footer">
    由 <a href="https://github.com/xing-shuyin/pi-web-ui-plugins" target="_blank">pi-web-ui-plugins</a> 社区自动化审查与构建系统生成
  </div>

  <script>
    function switchTab(name) {
      document.querySelectorAll('.nav-tab').forEach((el, idx) => {
        el.classList.toggle('active', (name === 'plugins' && idx === 0) || (name === 'themes' && idx === 1));
      });
      document.getElementById('tab-plugins').classList.toggle('active', name === 'plugins');
      document.getElementById('tab-themes').classList.toggle('active', name === 'themes');
    }
  </script>
</body>
</html>`;

  writeFileSync(OUT_HTML, htmlText, "utf8");

  console.log(
    `✅ Successfully built catalog with ${pluginEntries.length} plugins and ${themeEntries.length} themes.`,
  );
  console.log(
    `📁 Outputs:\n   - ${OUT_PLUGINS_JSON}\n   - ${OUT_THEMES_JSON}\n   - ${OUT_HTML}`,
  );
}

buildCatalog();
