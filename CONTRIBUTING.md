# Contributing to pi-web-ui Plugin & Theme Registry

欢迎为 `pi-web-ui` 生态贡献插件与主题！本仓库采用 **CI 全自动审核 + 自动化合并** 机制。只要插件或主题符合规范且属于低风险类别，PR 将被机器人自动审核、批准并合并。

> 💡 **提示**：若你的插件或主题是随 `pi-web-ui` 官方主程序分发的内置核心内容，请直接向主仓库 [xing-shuyin/pi-web-ui](https://github.com/xing-shuyin/pi-web-ui) 提交。本仓库专供第三方开发者独立创建并维护的开源社区插件与主题。

---

## 🚀 提交新插件（Plugin）的流程

### 1. 准备你的插件仓库
确保你的插件仓库满足以下条件：
- **开源公开仓库**：包含合法的开源协议（如 MIT、Apache-2.0 等）。
- **包含 `manifest.json`**：根目录或子目录需存在符合 pi-web-ui 规范的 `manifest.json`。
- **构建产物齐备**：若需要构建，请确保 release 或仓库内含有入口文件（如 `client/entry.mjs`）。

### 2. Fork 本仓库并添加插件元数据
1. Fork 本仓库并拉取到本地。
2. 创建属于你的插件目录：
   ```bash
   mkdir -p plugins/<your-plugin-id>
   ```
3. 在该目录下新建 `plugin.json`，格式如下：
   ```json
   {
     "id": "my-plugin",
     "name": "My Plugin Display Name",
     "nameEn": "My Plugin (English UI name, optional)",
     "source": "username/my-plugin-repo",
     "author": "username",
     "description": "这是插件的中文功能描述，不少于 5 个字。",
     "descriptionEn": "English description of the plugin.",
     "icon": "🚀",
     "homepage": "https://github.com/username/my-plugin-repo",
     "tags": ["tools", "view"]
   }
   ```
   > 详细字段定义请参考 `schemas/plugin.schema.json`。

### 3. 本地自检
```bash
node scripts/audit.mjs --target <your-plugin-id>
```

---

## 🎨 提交新主题（Theme）的流程

主题由元数据 `theme.json` 与声明式样式 `theme.css` 组成。由于 CSS 属于低风险纯展示资产，审核通过后将极速自动合并上架。

### 1. 创建主题目录与文件
1. 创建属于你的主题目录：
   ```bash
   mkdir -p themes/<your-theme-id>
   ```
2. 在该目录下创建 `theme.json`：
   ```json
   {
     "id": "my-awesome-theme",
     "name": "极简夜蓝 · Minimal Blue",
     "nameEn": "Minimal Blue",
     "author": "your-github-username",
     "description": "专为深夜长对话设计的护眼暗蓝调主题，主打高对比度代码高亮。",
     "scheme": "dark",
     "group": "community",
     "palette": {
       "bg": "#0f172a",
       "accent": "#38bdf8",
       "text": "#f8fafc",
       "accentContrast": "#0f172a",
       "swatches": ["#0f172a", "#1e293b", "#38bdf8", "#818cf8", "#4ade80"]
     },
     "tags": ["dark", "blue", "minimal"]
   }
   ```
   > 详细字段规范见 `schemas/theme.schema.json`。
3. 在同一目录下放置 `theme.css`（主题样式本体）：
   - 需定义 `:root` 并提供标准 CSS 变量（`--bg`, `--bg-elev`, `--text`, `--accent`, `--accent-contrast` 等）。
   - 禁止包含 `<script>`、`expression()`、`javascript:` 等恶意代码。
   - 禁止通过外部 `@import` 引用远程 CSS。

### 2. 本地自检
```bash
node scripts/audit.mjs --target <your-theme-id>
```

---

## 🛡️ CI 自动化审核与合并规则

### 1. 自动审核检查项
- ✅ **单 PR 单项原则**：每个 PR 只能添加或修改一个插件（`plugins/<id>/plugin.json`）或一个主题（`themes/<id>/theme.json` + `theme.css`）。请勿混合提交或修改其他保护文件。
- ✅ **JSON Schema 校验**：严格验证字段类型、长度、HEX 色值正则规范。
- ✅ **安全与纯净度扫描**：
  - 插件：审计权限（`dom`, `fs:`）与远端仓库合法性。
  - 主题：扫描 CSS 纯净度（严禁脚本伪协议、表达式与外部远程 import）。
- ✅ **色彩对比度守卫**：检验 `--accent-contrast` 配对与主色对比度地板（≥3.0:1 / 4.5:1）。

### 2. 风险分级与处置策略
| 风险等级 | 特征 | 处理方式 |
| :--- | :--- | :--- |
| 🟢 **LOW** | 普通插件、所有规范合格的主题 | **CI 自动 Approve 并自动合并（Auto-merge）** |
| 🟡 **MEDIUM** | 申请了特权 DOM 或敏感权限的插件 | 需 Maintainer 人工 Review 确认后合并 |
| 🔴 **HIGH** | Schema 校验失败、安全隐患、未授权路径修改 | CI 报错阻断并拒绝合并 |
