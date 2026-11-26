# pi-web-ui Community Plugin & Theme Registry

> `pi-web-ui` 官方社区第三方插件与主题清单仓库，供独立开发者与贡献者提交插件、主题，提供 GitHub Actions 自动化安全审查（CI Audit）与无人值守自动合并（Auto-Merge）。
>
> 🌐 **官方仓库**：[https://github.com/xing-shuyin/pi-web-ui-plugins](https://github.com/xing-shuyin/pi-web-ui-plugins)  
> 📦 **插件清单订阅 (Pages)**：`https://xing-shuyin.github.io/pi-web-ui-plugins/catalog.json`  
> 🎨 **主题清单订阅 (Pages)**：`https://xing-shuyin.github.io/pi-web-ui-plugins/themes.json`  
> 🖥️ **网页生态市场预览**：[https://xing-shuyin.github.io/pi-web-ui-plugins/](https://xing-shuyin.github.io/pi-web-ui-plugins/)
>
> 💡 **说明**：`pi-web-ui` 项目自带的官方内置插件与内置主题随主仓库直接分发维护，不需要且不在此仓库提交。本仓库专供第三方社区独立插件与主题的提交与收录。

---

## 🌟 仓库特性

- **双生态独立元数据管理**：
  - 插件：`plugins/<id>/plugin.json`
  - 主题：`themes/<id>/theme.json` 与 `themes/<id>/theme.css`
  - 彻底消除并发 PR 冲突。
- **CI 自动化安全审查**：
  - PR 范围校验（单 PR 仅允许修改单一插件或单一主题）。
  - JSON Schema 格式合法性校验（支持插件与主题专属 Schema）。
  - 插件：远端仓库真实性、开源协议、SVG 图标 XSS 过滤与权限风险评级。
  - 主题：CSS 纯净度扫描（严禁脚本、表达式与外部远程 import）、色彩对比度与可读性守卫。
- **无人值守自动合并**：低风险（LOW）插件与合格主题 PR 自动审查通过后，机器人自动 Approve 并合并。
- **自动化发布与同步**：合并后自动构建 `dist/catalog.json`、`dist/themes.json` 与网页端多 Tab 预览，并发布至 GitHub Pages。

---

## 📦 如何在 pi-web-ui 中订阅清单

> ✅ **插件清单已是 `pi-web-ui` 的官方默认清单**：服务端启动时若未配置 `PI_WEB_PLUGIN_CATALOG_URL`，
> 会自动拉取 `https://xing-shuyin.github.io/pi-web-ui-plugins/catalog.json` 并同步进插件市场，无需任何配置。

### 方式 1：覆盖默认清单（可选）

如需改用自定义清单或本地文件，启动 `pi-web-ui` 时显式指定：

```bash
export PI_WEB_PLUGIN_CATALOG_URL="https://your-own-catalog.example/catalog.json"
pi-web-ui
```

### 方式 2：关闭默认同步（可选）

显式设为空串或 `off` / `0` / `false` / `no` 即可关闭开机预同步：

```bash
export PI_WEB_PLUGIN_CATALOG_URL="off"
pi-web-ui
```

### 方式 3：客户端动态同步

在 `pi-web-ui` 界面中，通过控制台或接口直接调用：

```javascript
window.__piWebUiHost.reloadCatalog(
  "https://xing-shuyin.github.io/pi-web-ui-plugins/catalog.json",
  { replace: false },
);
```

---

## 🛠️ 本地开发与测试

```bash
# 1. 安装依赖
npm install

# 2. 全量审计现有插件与主题
npm test

# 3. 针对特定插件或主题进行审计测试
node scripts/audit.mjs --target tokyo-night
node scripts/audit.mjs --target pi-web-multigit

# 4. 构建聚合目录与网页产物
npm run build
```

---

## 🚀 提交贡献指南

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何编写 `plugin.json`、`theme.json` 及提交 Pull Request。
