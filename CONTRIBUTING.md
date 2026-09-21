# Contributing to pi-web-ui Plugin Registry

欢迎为 `pi-web-ui` 生态贡献插件！本仓库采用 **CI 全自动审核 + 自动化合并** 机制。只要插件符合规范且属于低风险类别，PR 将被机器人自动审核、批准并合并。

---

## 🚀 提交新插件的流程

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
在提交 PR 之前，可以在本地运行审计脚本检查是否通过：
```bash
# 安装依赖
npm install

# 针对你的插件运行审核
node scripts/audit.mjs --target <your-plugin-id>
```

### 4. 提交 Pull Request
- **单 PR 单插件原则**：每个 PR 只能添加或修改一个 `plugins/<id>/plugin.json`，请勿同时修改其他文件。
- 提交 PR 后，GitHub Actions 机器人将自动运行审核并在 PR 中回复详细审计报告。

---

## 🛡️ CI 自动化审核与合并规则

### 1. 自动审核检查项
- ✅ **PR 范围限制**：只允许修改单一插件的 `plugins/<id>/plugin.json`，防止恶意修改 CI 脚本或覆盖他人文件。
- ✅ **JSON Schema 校验**：严格验证字段类型、长度、正则表达式规范。
- ✅ **远端仓库对齐**：拉取并解析远端仓库的 `manifest.json`，校验插件名称、版本与开源 License。
- ✅ **图标安全检查**：如果提供 `iconSvg`，检查是否包含 `<script>`、事件监听等 XSS 风险模式。
- ✅ **权限审计**：检查是否申请了敏感权限（如特权 DOM、工作区外文件访问等）。

### 2. 风险分级与处置策略
| 风险等级 | 特征 | 处理方式 |
|---|---|---|
| 🟢 **LOW** | 普通工具/视图插件，无敏感权限，无特权 DOM，Schema 完整 | **CI 自动 Approve 并自动合并（Auto-merge）** |
| 🟡 **MEDIUM** | 申请了特权 DOM（`permissions: ["dom"]`）或特殊宿主 API | CI 打上 `needs-maintainer-review` 标签，需人工确认后合并 |
| 🔴 **HIGH** | Schema 校验失败、检测到安全隐患、修改了未授权路径 | CI 报错阻断并拒绝合并，需作者修复后重新推送 |

---

## 🔄 更新已有插件

若需更新插件信息（如修改描述、图标或调整分支）：
- 提交 PR 修改对应的 `plugins/<id>/plugin.json`。
- CI 会校验提交者与已有元数据的 `author` 是否一致，防止插件被恶意篡改。
