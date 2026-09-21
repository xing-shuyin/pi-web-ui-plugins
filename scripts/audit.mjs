#!/usr/bin/env node
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getChangedFiles, auditPrScope, listAllPlugins } from "./lib/pr-changes.mjs";
import { validatePluginSchema } from "./lib/schema-validator.mjs";
import { auditRemoteRepo } from "./lib/repo-checker.mjs";
import { auditSecurity } from "./lib/security-scan.mjs";

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
      pluginId,
      passed: false,
      risk: "HIGH",
      errors: [`Invalid JSON in plugins/${pluginId}/plugin.json: ${err.message}`],
      warnings: [],
      details: {},
    };
  }

  const errors = [];
  const warnings = [];

  // 1. 文件夹名与 id 一致性检查
  if (data.id !== pluginId) {
    errors.push(`Directory name "${pluginId}" does not match plugin id "${data.id}".`);
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

  let md = `## ${statusEmoji} Plugin Audit Report: \`${result.pluginId}\`\n\n`;
  md += `| Field | Value |\n`;
  md += `|---|---|\n`;
  md += `| **Plugin ID** | \`${result.pluginId}\` |\n`;
  md += `| **Name** | ${result.details.name || "N/A"} |\n`;
  md += `| **Author** | @${result.details.author || "N/A"} |\n`;
  md += `| **Source** | \`${result.details.source || "N/A"}\` |\n`;
  md += `| **Risk Level** | ${riskBadge} |\n`;
  md += `| **Permissions** | ${
    result.details.permissions?.length
      ? result.details.permissions.map((p) => `\`${p}\``).join(", ")
      : "*None*"
  } |\n\n`;

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

  if (result.passed && result.risk === "LOW") {
    md += `> ✨ **Auto-merge Recommendation**: All checks passed with low risk. This PR is safe to be merged automatically.\n`;
  } else if (result.passed && result.risk === "MEDIUM") {
    md += `> ℹ️ **Manual Approval Needed**: Checks passed, but elevated permissions or special features were detected. A maintainer must approve before merging.\n`;
  } else {
    md += `> 🛑 **Action Required**: Please address the errors above and push new commits to this PR.\n`;
  }

  return md;
}

async function main() {
  console.log("🔍 Running pi-web-ui plugin audit...\n");

  if (isTestAll) {
    const plugins = listAllPlugins();
    console.log(`Auditing all ${plugins.length} plugins in registry...`);
    let totalErrors = 0;
    for (const id of plugins) {
      const res = await auditSinglePlugin(id);
      if (!res.passed) {
        console.error(`❌ [${id}] Failed:`, res.errors);
        totalErrors++;
      } else {
        console.log(`✅ [${id}] OK (Risk: ${res.risk})`);
      }
    }
    if (totalErrors > 0) {
      process.exit(1);
    }
    console.log(`\n🎉 All ${plugins.length} plugins passed audit!`);
    return;
  }

  let targetPluginId = explicitTarget;

  if (!targetPluginId) {
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
          `## ❌ PR Scope Validation Failed\n\n${scope.errors.map((e) => `- ${e}`).join("\n")}\n`
        );
      }
      process.exit(1);
    }
    targetPluginId = scope.pluginId;
  }

  console.log(`Target plugin: "${targetPluginId}"`);
  const result = await auditSinglePlugin(targetPluginId);
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
      `auto_merge=${result.passed && result.risk === "LOW" ? "true" : "false"}\n`
    );
    appendFileSync(process.env.GITHUB_OUTPUT, `plugin_id=${result.pluginId}\n`);
  }

  if (!result.passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal audit runner error:", err);
  process.exit(1);
});
