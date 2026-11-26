import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateThemeSchema } from "./schema-validator.mjs";
import { parseSource } from "./repo-checker.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "../..");

const FORBIDDEN_CSS_PATTERNS = [
  {
    pattern: /<script\b/i,
    message: "CSS contains forbidden HTML <script> tag",
  },
  {
    pattern: /javascript\s*:/i,
    message: "CSS contains forbidden 'javascript:' pseudo-protocol",
  },
  {
    pattern: /expression\s*\(/i,
    message: "CSS contains forbidden IE 'expression()' construct",
  },
  {
    pattern: /-moz-binding\s*:/i,
    message: "CSS contains forbidden '-moz-binding' directive",
  },
  {
    pattern: /(?<![A-Za-z0-9-])behavior\s*:/i,
    message: "CSS contains forbidden 'behavior:' directive",
  },
  {
    pattern: /@import\s+["']https?:\/\//i,
    message:
      "Remote @import is forbidden. Themes must be self-contained or use relative bases.",
  },
];

/**
 * 转换 HEX 为 RGB
 */
function parseHex(hex) {
  if (!hex || typeof hex !== "string") return null;
  const clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6 || clean.length === 8) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

/**
 * WCAG 相对亮度计算
 */
function luminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * WCAG 对比度计算
 */
function contrast(hex1, hex2) {
  const rgb1 = parseHex(hex1);
  const rgb2 = parseHex(hex2);
  if (!rgb1 || !rgb2) return null;
  const l1 = luminance(rgb1);
  const l2 = luminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 从 GitHub raw 内容拉取文本文件
 */
async function fetchRawFile(owner, repo, branch, path, token) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const headers = { "User-Agent": "pi-web-ui-theme-audit-bot" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    let res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && token) {
      res = await fetch(url, {
        headers: { "User-Agent": "pi-web-ui-theme-audit-bot" },
        signal: AbortSignal.timeout(10_000),
      });
    }
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * 审计单个主题。
 */
export async function auditSingleTheme(
  themeId,
  token = process.env.GITHUB_TOKEN,
) {
  const themeDir = resolve(ROOT_DIR, `themes/${themeId}`);
  const themeFile = resolve(themeDir, "theme.json");

  if (!existsSync(themeFile)) {
    return {
      type: "theme",
      themeId,
      passed: false,
      risk: "HIGH",
      errors: [`File not found: themes/${themeId}/theme.json`],
      warnings: [],
      details: {},
    };
  }

  let data;
  try {
    data = JSON.parse(readFileSync(themeFile, "utf8"));
  } catch (err) {
    return {
      type: "theme",
      themeId,
      passed: false,
      risk: "HIGH",
      errors: [`Invalid JSON in themes/${themeId}/theme.json: ${err.message}`],
      warnings: [],
      details: {},
    };
  }

  const errors = [];
  const warnings = [];

  // 1. 文件夹名与 id 一致性检查
  if (data.id !== themeId) {
    errors.push(
      `Directory name "${themeId}" does not match theme id "${data.id}".`,
    );
  }

  // 2. Schema 校验
  const schemaResult = await validateThemeSchema(data);
  if (!schemaResult.valid) {
    errors.push(...schemaResult.errors.map((e) => `Schema error: ${e}`));
  }

  // 3. 获取并检查 CSS
  const localCssPath = resolve(themeDir, "theme.css");
  let cssContent = null;
  let isLocalCss = false;

  if (existsSync(localCssPath)) {
    try {
      cssContent = readFileSync(localCssPath, "utf8");
      isLocalCss = true;
    } catch (err) {
      errors.push(
        `Failed to read local themes/${themeId}/theme.css: ${err.message}`,
      );
    }
  } else if (data.source) {
    const parsed = parseSource(data.source);
    if (!parsed) {
      errors.push(
        `Invalid source format: "${data.source}". Must be "owner/repo" or "owner/repo/subdir".`,
      );
    } else {
      const candidates = [
        parsed.subdir ? `${parsed.subdir}/theme.css` : "theme.css",
        parsed.subdir ? `${parsed.subdir}/${themeId}.css` : `${themeId}.css`,
      ];
      for (const candidate of candidates) {
        cssContent = await fetchRawFile(
          parsed.owner,
          parsed.repo,
          parsed.branch,
          candidate,
          token,
        );
        if (cssContent) break;
      }
      if (!cssContent) {
        errors.push(
          `Could not fetch theme CSS from remote repository ${data.source} (tried: ${candidates.join(", ")}).`,
        );
      }
    }
  } else {
    errors.push(
      `No theme CSS found. Either include "themes/${themeId}/theme.css" locally or specify "source".`,
    );
  }

  // 4. CSS 安全审计
  if (cssContent) {
    for (const rule of FORBIDDEN_CSS_PATTERNS) {
      if (rule.pattern.test(cssContent)) {
        errors.push(rule.message);
      }
    }

    if (/url\s*\(\s*["']?https?:\/\//i.test(cssContent)) {
      warnings.push(
        "Theme CSS references external remote URLs (e.g. background images). Consider embedding SVG data-URIs instead to prevent tracking or broken links.",
      );
    }

    // 检查核心 CSS 变量是否包含
    if (!cssContent.includes("--bg") && !cssContent.includes("--accent")) {
      warnings.push(
        "Theme CSS does not appear to define standard pi-web-ui CSS variables (--bg, --accent, --text).",
      );
    }
  }

  // 5. 对比度守卫
  if (data.palette) {
    const bg = data.palette.bg;
    const text = data.palette.text;
    const accent = data.palette.accent;
    const accentContrast = data.palette.accentContrast;

    if (bg && text) {
      const ratio = contrast(bg, text);
      if (ratio !== null && ratio < 3.0) {
        warnings.push(
          `Low contrast between palette.bg (${bg}) and palette.text (${text}): ${ratio.toFixed(2)}:1 (minimum recommended 4.5:1).`,
        );
      }
    }

    if (accent && accentContrast) {
      const ratio = contrast(accent, accentContrast);
      if (ratio !== null && ratio < 3.0) {
        warnings.push(
          `Low contrast between palette.accent (${accent}) and palette.accentContrast (${accentContrast}): ${ratio.toFixed(2)}:1.`,
        );
      }
    }
  }

  const finalRisk = errors.length > 0 ? "HIGH" : "LOW";

  return {
    type: "theme",
    themeId,
    passed: errors.length === 0,
    risk: finalRisk,
    errors,
    warnings,
    details: {
      name: data.name,
      nameEn: data.nameEn,
      author: data.author,
      scheme: data.scheme,
      palette: data.palette,
      source: data.source,
      isLocalCss,
    },
  };
}
