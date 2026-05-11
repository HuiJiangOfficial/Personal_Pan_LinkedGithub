# GitHub 个人网盘（Cloudflare Pages + Functions）

基于 **GitHub 仓库 `drive/` 目录** 作为存储、**Cloudflare Pages + Pages Functions** 提供 API 与跨域支持的轻量个人网盘。前端为 **Vue 3 + Vite + Element Plus**，无数据库。

## 功能概览

- 递归列出 `drive/` 下所有文件（Git Tree API）
- 上传、下载、删除（GitHub Contents API）
- 在线预览：常见图片、PDF、文本类源码与 Markdown 等（通过受鉴权代理拉取内容，避免 `<img>` 无法带密码的问题）
- 简单访问密码（`SITE_PASSWORD`），校验在服务端完成
- 响应式布局，表格支持横向滚动，适配手机与桌面

## 目录结构

```
.
├── drive/              # 网盘文件存放目录（提交到 Git 的实际文件区）
├── web/                # 前端（Vue3 + Vite + Element Plus）
├── functions/          # Cloudflare Pages Functions（后端 API）
├── scripts/
│   └── sync-web-env.mjs   # 构建前将根目录 config 同步为 web/.env.production
├── config.example.js   # 配置模板（复制为 config.js）
├── package.json        # 根构建脚本：同步环境变量并构建 web
├── wrangler.toml       # Pages 配置与非机密环境变量 [vars]（机密仅控制台 / secret）
└── README.md
```

## 一、准备 GitHub

1. 使用本仓库（或 Fork），确保存在 `drive/` 目录。
2. 在 GitHub 创建 **Personal Access Token（classic）**，勾选 **`repo`**（私有仓库必选；公开仓库可勾选 `public_repo`）。
3. 记录你的 **用户名 / 仓库名 / 默认分支**（一般为 `main`）。

## 二、配置说明（核心）

### 0. 使用 `wrangler.toml` 管理环境变量（与控制台提示一致）

若你的 Cloudflare 提示：**「环境变量由 wrangler.toml 管理，仅机密可在仪表板配置」**，请按下面分工：

| 类型 | 配置位置 |
|------|----------|
| **非机密**（`GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_BRANCH`） | 仓库根目录 **`wrangler.toml`** 的 **`[vars]`** 段，改好后 `git push` 触发重新部署。 |
| **机密**（`GITHUB_TOKEN`、可选 `SITE_PASSWORD`） | **不要**写入 `wrangler.toml`。在 Cloudflare → **Pages 项目** → **变量和机密** → 添加 **机密（Secret）**；或使用命令行（需已 `wrangler login`）：`npx wrangler pages secret put GITHUB_TOKEN --project-name=<你的Pages项目名>`。 |

Functions 运行时读取的是 **合并后的 `env`**：`[vars]` + 机密。缺任一必填项时，网页会提示「服务端未完成配置」。

### 1. 根目录 `config.js`（可选：本地与构建时注入前端展示用 `VITE_*`）

```bash
copy config.example.js config.js   # Windows
# 或 cp config.example.js config.js
```

编辑 `config.js` 中的：

| 字段 | 说明 |
|------|------|
| `GITHUB_OWNER` | GitHub 用户名或组织名 |
| `GITHUB_REPO` | 仓库名 |
| `GITHUB_BRANCH` | 分支，默认 `main` |
| `GITHUB_TOKEN` | 仅用于本地或 CI；**不要提交到 Git** |
| `SITE_PASSWORD` | 访问站点时的简单密码；可为空表示不启用 |

> **重要**：**`GITHUB_TOKEN` 不要提交到 Git**（勿写入 `wrangler.toml` / `config.js`）。线上仅通过 **机密** 注入。  
> 若服务端配置已用 **`wrangler.toml` + 机密** 完成，根目录 **`config.js` 仍可省略**；此时构建阶段可在 Cloudflare **Build** 环境变量中设置 `VITE_GITHUB_OWNER`、`VITE_GITHUB_REPO`、`VITE_GITHUB_BRANCH`（与 `[vars]` 一致），以便页眉显示仓库名；或保留不含 Token 的 `config.js` 供 `sync-web-env.mjs` 生成 `web/.env.production`。

### 2. 本地联调（可选）

1. 复制 `.dev.vars.example` 为 `.dev.vars`，填写与 `config.js` 相同的敏感变量。
2. 在项目根目录执行：

```bash
cd web && npm install && cd ..
npx wrangler pages dev web -- npm run dev
```

浏览器访问终端里提示的本地地址。该命令会在同一源下挂载 `functions`，前端可直接请求 `/api/*`。

若你**只**运行 `cd web && npm run dev`，可在另一个终端运行 `npx wrangler pages dev web`（默认 `8788`），并在启动 Vite 前设置环境变量 `VITE_PROXY_API=1`，由 `web/vite.config.js` 将 `/api` 代理到 `http://127.0.0.1:8788`。

## 三、Cloudflare Pages 一键部署

1. 将本仓库推送到 GitHub。
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 选择仓库后配置：

| 项 | 建议值 |
|----|--------|
| **Root directory** | `/`（仓库根） |
| **Build command** | `npm run build` |
| **Build output directory** | `web/dist` |
| **Environment variables** | 若账号要求 **仅用 wrangler.toml 管普通变量**：在 **`wrangler.toml` 的 `[vars]`** 填写 `GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_BRANCH`；在控制台 **仅添加机密** `GITHUB_TOKEN`（及可选 `SITE_PASSWORD`）。若控制台仍允许 **Build** 变量，可额外设置 `VITE_GITHUB_*` 供页眉展示。 |

4. 首次部署完成后访问 Pages 分配的 **`*.pages.dev`** 域名即可（不要用 `*.workers.dev`）。

> **构建环境变量**：若你不想在构建机读取仓库内 `config.js`，也可在 Cloudflare **Build** 环境变量里设置 `VITE_GITHUB_OWNER`、`VITE_GITHUB_REPO`、`VITE_GITHUB_BRANCH`，`sync-web-env.mjs` 会优先采用这些值写入 `web/.env.production`。

## 四、API 一览（Pages Functions）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 是否已配置、是否需要访问密码（无需密码头） |
| POST | `/api/verify` | JSON `{ "password": "..." }` 校验密码 |
| GET | `/api/list` | 列出 `drive/` 下文件；需密码头（若启用密码） |
| GET | `/api/raw?path=` | 代理文件内容；`download=1` 触发下载响应头 |
| POST | `/api/upload` | `multipart/form-data`，字段 `file`，可选 `path`（子路径或目录前缀） |
| DELETE | `/api/file?path=` | 删除文件 |

鉴权请求头（启用 `SITE_PASSWORD` 时）：

- `X-Site-Password: <密码>`，或
- `Authorization: Bearer <密码>`

跨域由 `functions/_middleware.js` 统一添加 CORS 响应头。

## 五、限制与说明

- GitHub API 有速率与单文件大小限制；本项目中上传在 Worker 内做了约 **45MB** 的保守限制，过大文件请考虑 Git LFS 或其它存储。
- 目录树使用 **recursive tree**；若仓库极大，`truncated` 可能为 `true`，界面会提示。
- 访问密码为**简单对称口令**，仅适合防随手访问；更高安全需求请叠加 Cloudflare Access 或 OAuth 等方案。
- **切勿**把 `GITHUB_TOKEN` 写进前端代码或公开 `config.js`。

## 六、开源协议

MIT（若你需其它协议可自行修改）。
