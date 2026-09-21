# pi-web-ui Community Plugin Registry

> `pi-web-ui` 官方社区插件清单仓库，支持第三方插件提交、GitHub Actions 自动化审查（CI Audit）与自动合并（Auto-Merge）。

---

## 🌟 仓库特性

- **独立元数据管理**：每个插件对应独立目录 `plugins/<id>/plugin.json`，彻底消除 PR 并发合并冲突。
- **CI 自动化安全审查**：
  - PR 范围校验（单 PR 仅允许修改单一插件）。
  - JSON Schema 格式合法性校验。
  - 远端仓库真实性、开源协议与 `manifest.json` 一致性校验。
  - SVG 图标 XSS 过滤与权限风险评级（LOW / MEDIUM / HIGH）。
- **无人值守自动合并**：低风险（LOW）插件 PR 自动审查通过后，机器人自动 Approve 并合并。
- **自动化发布与同步**：合并后自动构建 `dist/catalog.json`，并发布至 GitHub Pages，供所有 `pi-web-ui` 客户端订阅。

---

## 📦 如何在 pi-web-ui 中订阅本清单

### 方式 1：服务端全局环境变量配置
启动 `pi-web-ui` 时，指定插件清单的 GitHub Pages 地址：
```bash
export PI_WEB_PLUGIN_CATALOG_URL="https://xing-shuyin.github.io/pi-web-ui-plugins/catalog.json"
pi-web-ui
```
启动时服务端会自动拉取该清单并同步进插件市场。

### 方式 2：客户端动态同步
在 `pi-web-ui` 界面中，通过支持目录同步的插件或控制台直接调用：
```javascript
window.__piWebUiHost.reloadCatalog(
  "https://xing-shuyin.github.io/pi-web-ui-plugins/catalog.json",
  { replace: false }
);
```

---

## 🛠️ 本地开发与测试

```bash
# 1. 安装依赖
npm install

# 2. 全量审计现有插件
npm test

# 3. 针对特定插件进行审计测试
node scripts/audit.mjs --target notes

# 4. 构建聚合目录
npm run build
```

---

## 🚀 仓库创建与部署指南（维护者）

如果你是维护者，准备将本仓库推送到 GitHub：

1. **新建 GitHub 仓库**：
   在 GitHub 上创建一个公开仓库，例如 `pi-web-ui-plugins`。
2. **推送代码**：
   ```bash
   cd plugin-registry
   git init
   git branch -M main
   git remote add origin git@github.com:xing-shuyin/pi-web-ui-plugins.git
   git add .
   git commit -m "feat: initial commit of plugin registry with automated CI audit"
   git push -u origin main
   ```
3. **开启 GitHub Pages**：
   - 仓库设置 -> **Settings** -> **Pages**。
   - Source 选择 **GitHub Actions**。
4. **配置 PR 自动合并权限**：
   - 仓库设置 -> **Settings** -> **General** -> 勾选 **Allow auto-merge**。
   - 仓库设置 -> **Settings** -> **Actions** -> **General** -> **Workflow permissions** -> 选择 **Read and write permissions**，并勾选 **Allow GitHub Actions to create and approve pull requests**。

---

## 🤝 贡献插件

请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解提交流程与规范。
