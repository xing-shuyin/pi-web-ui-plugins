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
    return output.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    // 如果没有 origin/main，尝试对比 HEAD~1
    try {
      const output = execSync("git diff --name-only HEAD~1", {
        cwd: ROOT_DIR,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return output.split("\n").map((s) => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
}

/**
 * 校验 PR 变更范围。
 * @param {string[]} changedFiles 改动的文件列表
 * @returns {{ ok: boolean, pluginId: string | null, errors: string[] }}
 */
export function auditPrScope(changedFiles) {
  const errors = [];
  if (!changedFiles || changedFiles.length === 0) {
    return { ok: false, pluginId: null, errors: ["No files changed in this PR."] };
  }

  const touchedPluginIds = new Set();

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
      errors.push(`Forbidden change to protected file: "${file}". PRs may only touch files under plugins/<id>/.`);
      continue;
    }

    const match = normalized.match(/^plugins\/([A-Za-z0-9_-]+)\/plugin\.json$/);
    if (!match) {
      errors.push(`File "${file}" is not allowed. Only "plugins/<plugin-id>/plugin.json" can be modified or added.`);
      continue;
    }

    touchedPluginIds.add(match[1]);
  }

  if (touchedPluginIds.size === 0 && errors.length === 0) {
    errors.push("No plugin.json found in PR changes.");
  } else if (touchedPluginIds.size > 1) {
    errors.push(
      `A single PR can only submit or update 1 plugin at a time. Found ${touchedPluginIds.size} plugins: ${[...touchedPluginIds].join(", ")}`
    );
  }

  const pluginId = touchedPluginIds.size === 1 ? [...touchedPluginIds][0] : null;

  return {
    ok: errors.length === 0,
    pluginId,
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
