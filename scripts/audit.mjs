#!/usr/bin/env node
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getChangedFiles,
  auditPrScope,
  listAllPlugins,
  listAllThemes,
} from "./lib/pr-changes.mjs";
import { validatePluginSchema } from "./lib/schema-validator.mjs";
import { auditRemoteRepo } from "./lib/repo-checker.mjs";
import { auditSecurity } from "./lib/security-scan.mjs";
import { auditSingleTheme } from "./lib/theme-audit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

const args = process.argv.slice(2);
const isTestAll = args.includes("--test-all");
const targetArgIdx = args.indexOf("--target");
const explicitTarget = targetArgIdx >= 0 ? args[targetArgIdx + 1] : null;

async function auditSinglePlugin(pluginId) {
  const pluginFile = resolve(ROOT_DIR, `plugins/${pluginId}/plugin.json`);
  if (!existsSync(pluginFile)) {
    return {
      type: "plugin",
      pluginId,
      passed: false,
      risk: "HIGH",
      errors: [`File not found: plugins/${pluginId}/plugin.json`],
      warnings: [],
      details: {},
    };
  }

  let data;
  try {
    data = JSON.parse(readFileSync(pluginFile, "utf8"));
  } catch (err) {
    return {
      type: "plugin",
      pluginId,
      passed: false,
      risk: "HIGH",
      errors: [
        `Invalid JSON in plugins/${pluginId}/plugin.json: ${err.message}`,
      ],
      warnings: [],
      details: {},
    };
  }

  const errors = [];
  const warnings = [];

  // 1. 文件夹名与 id 一致性检查
  if (data.id !== pluginId) {
    errors.push(
      `Directory name "${pluginId}" does not match plugin id "${data.id}".`,
    );
  }

  // 2. Schema 校验
  const schemaResult = await validatePluginSchema(data);
  if (!schemaResult.valid) {
    errors.push(...schemaResult.errors.map((e) => `Schema error: ${e}`));
  }

  // 3. 远端仓库与 Manifest 校验
  const repoResult = await auditRemoteRepo(data);
  if (!repoResult.ok) {
    errors.push(...repoResult.errors);
  }
  warnings.push(...repoResult.warnings);

  // 4. 安全扫描与风险评级
  const securityResult = auditSecurity(data, repoResult.manifest);
  if (securityResult.reasons.length > 0) {
    errors.push(...securityResult.reasons);
  }
  warnings.push(...securityResult.warnings);

  let finalRisk = securityResult.risk;
  if (errors.length > 0) {
    finalRisk = "HIGH";
  }

  return {
    type: "plugin",
    pluginId,
    passed: errors.length === 0,
    risk: finalRisk,
    errors,
    warnings,
    details: {
      name: data.name,
      source: data.source,
      author: data.author,
      permissions: securityResult.permissions,
      manifest: repoResult.manifest,
    },
  };
}

function renderMarkdownReport(result) {
  const statusEmoji = result.passed ? "✅" : "❌";
  const riskBadge =
    result.risk === "LOW"
      ? "🟢 **LOW RISK** (Eligible for auto-merge)"
      : result.risk === "MEDIUM"
        ? "🟡 **MEDIUM RISK** (Needs maintainer review)"
        : "🔴 **HIGH RISK** (Changes required)";

  const isTheme = result.type === "theme";
  const targetId = isTheme ? result.themeId : result.pluginId;

  let md = `## ${statusEmoji} ${isTheme ? "Theme" : "Plugin"} Audit Report: \`${targetId}\`\n\n`;
  md += `| Field | Value |\n`;
  md += `|---|---|\n`;
  md += `| **Type** | \`${isTheme ? "Theme (视觉主题)" : "Plugin (功能插件)"}\` |\n`;
  md += `| **ID** | \`${targetId}\` |\n`;
  md += `| **Name** | ${result.details.name || "N/A"} |\n`;
  md += `| **Author** | @${result.details.author || "N/A"} |\n`;

  if (isTheme) {
    md += `| **Scheme** | \`${result.details.scheme || "N/A"}\` |\n`;
    if (result.details.palette) {
      const swatches = (
        result.details.palette.swatches || [
          result.details.palette.bg,
          result.details.palette.accent,
          result.details.palette.text,
        ]
      )
        .filter(Boolean)
        .map((c) => `\`${c}\``)
        .join(" ");
      md += `| **Palette** | ${swatches} |\n`;
    }
  } else {
    md += `| **Source** | \`${result.details.source || "N/A"}\` |\n`;
    md += `| **Permissions** | ${
      result.details.permissions?.length
        ? result.details.permissions.map((p) => `\`${p}\``).join(", ")
        : "*None*"
    } |\n`;
  }

  md += `| **Risk Level** | ${riskBadge} |\n\n`;

  if (result.errors.length > 0) {
    md += `### ❌ Errors (Must be resolved)\n`;
    for (const err of result.errors) {
      md += `- ${err}\n`;
    }
    md += `\n`;
  }

  if (result.warnings.length > 0) {
    md += `### ⚠️ Warnings / Notes\n`;
    for (const warn of result.warnings) {
      md += `- ${warn}\n`;
    }
    md += `\n`;
  }

  if (result.passed) {
    md += `> ✨ **Auto-merge Recommendation**: All checks passed. This PR is safe to be merged automatically.\n`;
  } else {
    md += `> 🛑 **Action Required**: Please address the errors above and push new commits to this PR.\n`;
  }

  return md;
}

async function main() {
  console.log("🔍 Running pi-web-ui registry audit...\n");

  if (isTestAll) {
    const plugins = listAllPlugins();
    const themes = listAllThemes();
    console.log(
      `Auditing all ${plugins.length} plugins and ${themes.length} themes in registry...`,
    );

    let totalErrors = 0;

    for (const id of plugins) {
      const res = await auditSinglePlugin(id);
      if (!res.passed) {
        console.error(`❌ [plugin:${id}] Failed:`, res.errors);
        totalErrors++;
      } else {
        console.log(`✅ [plugin:${id}] OK (Risk: ${res.risk})`);
      }
    }

    for (const id of themes) {
      const res = await auditSingleTheme(id);
      if (!res.passed) {
        console.error(`❌ [theme:${id}] Failed:`, res.errors);
        totalErrors++;
      } else {
        console.log(`✅ [theme:${id}] OK (Risk: ${res.risk})`);
      }
    }

    if (totalErrors > 0) {
      process.exit(1);
    }
    console.log(
      `\n🎉 All ${plugins.length} plugins and ${themes.length} themes passed audit!`,
    );
    return;
  }

  let targetId = explicitTarget;
  let targetType = null;

  if (targetId) {
    if (existsSync(resolve(ROOT_DIR, `themes/${targetId}`))) {
      targetType = "theme";
    } else {
      targetType = "plugin";
    }
  } else {
    // 自动检测 PR 变更
    const changedFiles = getChangedFiles();
    console.log("Changed files detected:", changedFiles);
    const scope = auditPrScope(changedFiles);
    if (!scope.ok) {
      console.error("❌ PR Scope Validation Failed:");
      for (const err of scope.errors) console.error(`  - ${err}`);
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          `## ❌ PR Scope Validation Failed\n\n${scope.errors.map((e) => `- ${e}`).join("\n")}\n`,
        );
      }
      process.exit(1);
    }
    targetId = scope.id;
    targetType = scope.type;
  }

  console.log(`Target: [${targetType}] "${targetId}"`);
  const result =
    targetType === "theme"
      ? await auditSingleTheme(targetId)
      : await auditSinglePlugin(targetId);

  const reportMd = renderMarkdownReport(result);

  console.log("\n" + reportMd);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, reportMd + "\n");
  }

  // 暴露输出变量给 GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `passed=${result.passed}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `risk=${result.risk}\n`);
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `auto_merge=${result.passed ? "true" : "false"}\n`,
    );
    appendFileSync(process.env.GITHUB_OUTPUT, `target_id=${targetId}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `target_type=${targetType}\n`);
  }

  if (!result.passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal audit runner error:", err);
  process.exit(1);
});
