/**
 * 插件安全审计与风险评级。
 */

const DANGEROUS_SVG_PATTERNS = [
  /<script\b/i,
  /\bon\w+\s*=/i, // 如 onload=, onerror=, onclick=
  /javascript\s*:/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /<foreignObject\b/i,
];

/**
 * 校验 SVG 图标安全性。
 */
export function auditSvgSecurity(svg) {
  if (!svg) return { safe: true, issues: [] };
  const issues = [];
  for (const pattern of DANGEROUS_SVG_PATTERNS) {
    if (pattern.test(svg)) {
      issues.push(`SVG contains forbidden unsafe pattern: ${pattern.toString()}`);
    }
  }
  return {
    safe: issues.length === 0,
    issues,
  };
}

/**
 * 审计权限声明与安全风险。
 * @param {object} pluginData plugin.json 数据
 * @param {object | null} remoteManifest 远端 manifest.json 数据
 * @returns {{ risk: "LOW" | "MEDIUM" | "HIGH", reasons: string[], warnings: string[] }}
 */
export function auditSecurity(pluginData, remoteManifest) {
  const reasons = [];
  const warnings = [];
  let risk = "LOW";

  // 1. 检查 SVG 安全性
  if (pluginData.iconSvg) {
    const svgAudit = auditSvgSecurity(pluginData.iconSvg);
    if (!svgAudit.safe) {
      risk = "HIGH";
      reasons.push(...svgAudit.issues);
    }
  }

  // 2. 检查权限 (Permissions)
  const permissions = Array.isArray(remoteManifest?.permissions)
    ? remoteManifest.permissions
    : [];

  if (permissions.includes("dom")) {
    // 特权 DOM 访问：需要在设置面板逐个授权
    if (risk !== "HIGH") risk = "MEDIUM";
    warnings.push(
      "Plugin requests privileged 'dom' permission (requires user manual consent in UI settings). Human review recommended."
    );
  }

  if (permissions.some((p) => typeof p === "string" && p.startsWith("fs:"))) {
    if (risk !== "HIGH") risk = "MEDIUM";
    warnings.push("Plugin requests filesystem permissions outside workspace.");
  }

  // 3. 检查 apiVersion
  if (remoteManifest?.apiVersion && remoteManifest.apiVersion > 2) {
    warnings.push(
      `Plugin declares apiVersion ${remoteManifest.apiVersion}, which is newer than host supported version (2).`
    );
  }

  return {
    risk,
    reasons,
    warnings,
    permissions,
  };
}
