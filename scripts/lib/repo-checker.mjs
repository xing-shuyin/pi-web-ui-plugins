/**
 * 解析并校验远端 GitHub 仓库与 manifest.json。
 */

/**
 * 解析 source 字符串。
 * 支持：
 * - owner/repo
 * - owner/repo/subdir
 * - owner/repo/subdir#branch
 * - https://github.com/owner/repo...
 */
export function parseSource(source) {
  let cleaned = String(source || "").trim();
  if (cleaned.startsWith("https://github.com/")) {
    cleaned = cleaned.replace("https://github.com/", "");
  }
  const [repoPath, branch = "main"] = cleaned.split("#");
  const segments = repoPath.replace(/\/+$/, "").split("/").filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const owner = segments[0];
  const repo = segments[1];
  const subdir = segments.slice(2).join("/");

  return {
    owner,
    repo,
    subdir: subdir || "",
    branch,
    fullRepo: `${owner}/${repo}`,
  };
}

/**
 * 从 GitHub raw 内容拉取文本文件（带超时与重试）。
 */
async function fetchRawFile(owner, repo, branch, path, token) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const headers = {
    "User-Agent": "pi-web-ui-plugin-audit-bot",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * 校验目标仓库与 manifest.json。
 */
export async function auditRemoteRepo(pluginData, token = process.env.GITHUB_TOKEN) {
  const errors = [];
  const warnings = [];
  const parsed = parseSource(pluginData.source);

  if (!parsed) {
    errors.push(`Invalid source format: "${pluginData.source}". Must be "owner/repo" or "owner/repo/subdir".`);
    return { ok: false, errors, warnings, manifest: null };
  }

  const manifestPath = parsed.subdir ? `${parsed.subdir}/manifest.json` : "manifest.json";
  let manifestText = await fetchRawFile(parsed.owner, parsed.repo, parsed.branch, manifestPath, token);

  // 如果主分支是 master，做一次降级尝试
  if (!manifestText && parsed.branch === "main") {
    manifestText = await fetchRawFile(parsed.owner, parsed.repo, "master", manifestPath, token);
  }

  if (!manifestText) {
    warnings.push(
      `Could not fetch "${manifestPath}" from ${parsed.owner}/${parsed.repo}#${parsed.branch}. (Check if repository is public and branch/subdir is correct)`
    );
    // 网络问题时仅作为警告，不直接阻断本地无网开发，但在 CI 必须有
    return {
      ok: errors.length === 0,
      errors,
      warnings,
      manifest: null,
      parsedSource: parsed,
    };
  }

  let manifest = null;
  try {
    manifest = JSON.parse(manifestText);
  } catch (err) {
    errors.push(`Failed to parse remote manifest.json: ${err.message}`);
    return { ok: false, errors, warnings, manifest: null, parsedSource: parsed };
  }

  // 校验 manifest 规范
  if (!manifest.name && !manifest.id) {
    errors.push("Remote manifest.json is missing 'name' or 'id' field.");
  }
  if (!manifest.version) {
    warnings.push("Remote manifest.json does not declare a 'version' field.");
  }

  // 检查 License
  const licensePath = parsed.subdir ? `${parsed.subdir}/LICENSE` : "LICENSE";
  let licenseText = await fetchRawFile(parsed.owner, parsed.repo, parsed.branch, licensePath, token);
  if (!licenseText) {
    licenseText = await fetchRawFile(parsed.owner, parsed.repo, parsed.branch, "LICENSE.md", token);
  }
  if (!licenseText && !manifest.license) {
    warnings.push("No LICENSE or LICENSE.md file found in remote repository.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    manifest,
    parsedSource: parsed,
  };
}
