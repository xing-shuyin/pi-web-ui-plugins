import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, "../../schemas/plugin.schema.json");

let ajvInstance = null;

async function getAjv() {
  if (ajvInstance) return ajvInstance;
  try {
    const { default: Ajv } = await import("ajv");
    const { default: addFormats } = await import("ajv-formats");
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    ajvInstance = ajv;
    return ajv;
  } catch {
    return null;
  }
}

/**
 * 校验 plugin.json 对象是否符合规范。
 * 支持完整 Ajv 校验与无依赖兜底校验。
 */
export async function validatePluginSchema(data) {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = await getAjv();

  if (ajv) {
    const validate = ajv.compile(schema);
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors || []).map((err) => `${err.instancePath || "/"} ${err.message}`);
      return { valid: false, errors };
    }
    return { valid: true, errors: [] };
  }

  // 兜底校验（无依赖环境）
  const errors = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data must be an object"] };
  }
  for (const req of schema.required || []) {
    if (!data[req]) errors.push(`Missing required property: ${req}`);
  }
  if (data.id && !/^[A-Za-z0-9_-]+$/.test(data.id)) {
    errors.push("Property 'id' does not match pattern ^[A-Za-z0-9_-]+$");
  }
  if (data.iconSvg && (!data.iconSvg.startsWith("<svg") || !data.iconSvg.endsWith("</svg>"))) {
    errors.push("Property 'iconSvg' must begin with <svg and end with </svg>");
  }
  return { valid: errors.length === 0, errors };
}
