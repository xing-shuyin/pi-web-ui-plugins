import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "../..");

/**
 * 获取 Git 改动的文件列表。
 * @param {string} baseRef 基准分支，如 origin/main 或 main
 * @returns {string[]}
 */
export function getChangedFiles(baseRef = "origin/main") {
  try {
    const output = execSync(`git diff --name-only ${baseRef}...HEAD`, {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    // 如果没有 origin/main，尝试对比 HEAD~1
    try {
      const output = execSync("git diff --name-only HEAD~1", {
        cwd: ROOT_DIR,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return output
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

/**
 * 校验 PR 变更范围。
 * 允许单个 PR 变更：
 * 1. 单个插件：`plugins/<id>/plugin.json`
 * 2. 单个主题：`themes/<id>/theme.json` 以及可选的 `themes/<id>/theme.css`
 *
 * @param {string[]} changedFiles 改动的文件列表
 * @returns {{ ok: boolean, type: "plugin" | "theme" | null, id: string | null, errors: string[] }}
 */
export function auditPrScope(changedFiles) {
  const errors = [];
  if (!changedFiles || changedFiles.length === 0) {
    return {
      ok: false,
      type: null,
      id: null,
      errors: ["No files changed in this PR."],
    };
  }

  const touchedPluginIds = new Set();
  const touchedThemeIds = new Set();

  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, "/");

    // 严禁修改根目录核心逻辑
    if (
      normalized.startsWith(".github/") ||
      normalized.startsWith("scripts/") ||
      normalized.startsWith("schemas/") ||
      normalized === "package.json" ||
      normalized === "package-lock.json"
    ) {
      errors.push(
        `Forbidden change to protected file: "${file}". PRs may only touch files under plugins/<id>/ or themes/<id>/.`,
      );
      continue;
    }

    const pluginMatch = normalized.match(
      /^plugins\/([A-Za-z0-9_-]+)\/plugin\.json$/,
    );
    if (pluginMatch) {
      touchedPluginIds.add(pluginMatch[1]);
      continue;
    }

    const themeMatch = normalized.match(
      /^themes\/([A-Za-z0-9_-]+)\/(theme\.json|theme\.css)$/,
    );
    if (themeMatch) {
      touchedThemeIds.add(themeMatch[1]);
      continue;
    }

    errors.push(
      `File "${file}" is not allowed. Only "plugins/<plugin-id>/plugin.json" or "themes/<theme-id>/(theme.json|theme.css)" can be modified or added.`,
    );
  }

  // 跨类型或多项校验
  if (touchedPluginIds.size > 0 && touchedThemeIds.size > 0) {
    errors.push(
      "A single PR cannot mix plugin and theme changes. Please submit plugins and themes in separate PRs.",
    );
  } else if (touchedPluginIds.size > 1) {
    errors.push(
      `A single PR can only submit or update 1 plugin at a time. Found ${touchedPluginIds.size} plugins: ${[...touchedPluginIds].join(", ")}`,
    );
  } else if (touchedThemeIds.size > 1) {
    errors.push(
      `A single PR can only submit or update 1 theme at a time. Found ${touchedThemeIds.size} themes: ${[...touchedThemeIds].join(", ")}`,
    );
  }

  if (
    touchedPluginIds.size === 0 &&
    touchedThemeIds.size === 0 &&
    errors.length === 0
  ) {
    errors.push("No plugin.json or theme.json found in PR changes.");
  }

  const isPlugin = touchedPluginIds.size === 1;
  const isTheme = touchedThemeIds.size === 1;

  const type = isPlugin ? "plugin" : isTheme ? "theme" : null;
  const id = isPlugin
    ? [...touchedPluginIds][0]
    : isTheme
      ? [...touchedThemeIds][0]
      : null;

  return {
    ok: errors.length === 0,
    type,
    id,
    errors,
  };
}

/**
 * 获取仓库内所有已存在的插件 ID 列表。
 */
export function listAllPlugins() {
  const pluginsDir = resolve(ROOT_DIR, "plugins");
  if (!existsSync(pluginsDir)) return [];
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * 获取仓库内所有已存在的主题 ID 列表。
 */
export function listAllThemes() {
  const themesDir = resolve(ROOT_DIR, "themes");
  if (!existsSync(themesDir)) return [];
  return readdirSync(themesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => existsSync(resolve(themesDir, `${id}/theme.json`)));
}
