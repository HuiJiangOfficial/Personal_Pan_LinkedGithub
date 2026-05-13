# 这是一个使用GitHub仓库作为网盘存储服务器+Cloudflare构建WebUI的个人网盘部署方案（Cloudflare Pages + Functions）

## This is a personal cloud storage deployment solution that uses GitHub repository as the storage server and builds WebUI via Cloudflare (Cloudflare Pages + Functions). 

基于 **GitHub 仓库 `drive/` 目录** 作为存储、**Cloudflare Pages + Pages Functions** 提供 API 与跨域支持的轻量个人网盘。前端为 **Vue 3 + Vite + Element Plus**，无数据库。



# **本项目仅供个人交流学习使用，严禁滥用、严禁存放不符合您所在地区法律规范的文件、严禁存放不符合互联网规范的文件、严禁商用与侵占公共资源、严禁售卖，严谨存放大量文件为仓库服务器造成压力。**

# **免责声明：本项目不提供任何服务器，且不能给项目贡献者带来任何收益。本项目所带来的风险由克隆者自行承担。**



# **部署指南请阅读[Guide(CN).md](https://github.com/HuiJiangOfficial/Personal_Pan_LinkedGithub/blob/main/Guide(CN).md)**





## 功能概览

- 递归列出 `drive/` 下所有文件（Git Tree API）
- 上传、下载、删除（GitHub Contents API）
- 在线预览：常见图片、PDF、文本类源码与 Markdown 等（通过受鉴权代理拉取内容，避免 `<img>` 无法带密码的问题）
- **用户与角色**：管理员（环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD`）、普通用户（自注册，凭据写入仓库 `drive/.webpan/system/users.json`，密码为 **PBKDF2-SHA256 哈希**）、访客 `guest`（无密码；默认关闭，且默认不可见任何文件；管理员可开启并配置可见路径前缀）
- 基于 **HttpOnly Cookie + JWT** 的登录态（`JWT_SECRET` 为机密）
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



## **以下部署教程为简略教程，详细教程请阅读[Guide(CN).md](https://github.com/HuiJiangOfficial/Personal_Pan_LinkedGithub/blob/main/Guide(CN).md)**

## 一、准备 GitHub

1. 克隆本仓库。
2. 在 GitHub 创建 **Personal Access Token（classic）**，勾选 **`repo`**（私有仓库必选；公开仓库可勾选 `public_repo`）。
3. 记录你的 **用户名 / 仓库名 / 默认分支**（一般为 `main`）。

## 二、配置说明（核心）

### 0. 使用 `wrangler.toml` 管理环境变量（与控制台提示一致）

若你的 Cloudflare 提示：**「环境变量由 wrangler.toml 管理，仅机密可在仪表板配置」**，请按下面分工：

| 类型 | 配置位置 |
|------|----------|
| **非机密** | `GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_BRANCH` 写在 **`wrangler.toml` 的 `[vars]`**；可选 **`ADMIN_USERNAME`**（默认 `admin`）也可写在 `[vars]` 或控制台「变量」。 |
| **机密** | `GITHUB_TOKEN`、`JWT_SECRET`、`ADMIN_PASSWORD` **不要**写入 `wrangler.toml`。在 Cloudflare → **Pages 项目** → **变量和机密** → **机密（Secret）**；或使用 `wrangler pages secret put`。 |

Functions 运行时读取的是 **合并后的 `env`**：`[vars]` + 机密。缺 GitHub 三项时网页会提示「服务端未完成配置」；缺 `JWT_SECRET` 或管理员密码时无法完成登录鉴权（见 `/api/status` 的 `varsPresent`）。

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
| （勿放 `config.js`） | `JWT_SECRET`、`ADMIN_USERNAME`、`ADMIN_PASSWORD` 仅在 Cloudflare 机密/变量或 `.dev.vars` 中配置，见上文与 `.dev.vars.example` |

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
| **Environment variables** | 在 **`wrangler.toml` 的 `[vars]`** 填写 `GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_BRANCH`；在控制台添加机密 **`GITHUB_TOKEN`、`JWT_SECRET`、`ADMIN_PASSWORD`**（及可选 `ADMIN_USERNAME`）。若控制台仍允许 **Build** 变量，可额外设置 `VITE_GITHUB_*` 供页眉展示。 |

4. 首次部署完成后访问 Pages 分配的 **`*.pages.dev`** 域名即可（不要用 `*.workers.dev`）。

### 控制台关于「Wrangler 配置文件」的警告

若提示：**本地 `wrangler.toml` 需与 Pages 项目设置一致**，或建议**不要手写、应下载配置**，可按官方流程对齐：

1. 本机安装 Node 后执行 **`npx wrangler login`**。  
2. 在**本仓库根目录**执行（将 `<Pages项目名>` 换成控制台里该 Pages 的名称）：

```bash
npx wrangler pages download config <Pages项目名>
```

3. 若根目录已有 `wrangler.toml` 且命令询问是否覆盖，可按提示确认，或使用 **`--force`**（会覆盖本地文件，建议先 `git stash` 或备份）。  
4. 打开生成/更新后的 `wrangler.toml`，**人工核对**是否仍包含本项目所需项，尤其是 **`pages_build_output_dir = "web/dist"`** 以及 **`[vars]`** 里的 `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH`（下载结果可能不包含你在 Git 里写的 `[vars]`，缺失则补回）。  
5. **机密**（`GITHUB_TOKEN`、`JWT_SECRET`、`ADMIN_PASSWORD` 等）**不会**被下载进文件，仍只在控制台 **Secrets** 或通过 `wrangler pages secret put` 管理。  
6. 确认无误后 `git commit` + `git push`，让 Git 集成部署使用与线上一致的配置。

官方说明：[Wrangler `pages download config`](https://developers.cloudflare.com/workers/wrangler/commands/pages/#pages-download-config)（文档中标注为 **Experimental**）、[Pages Functions 与 wrangler.toml](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)。

> **构建环境变量**：若你不想在构建机读取仓库内 `config.js`，也可在 Cloudflare **Build** 环境变量里设置 `VITE_GITHUB_OWNER`、`VITE_GITHUB_REPO`、`VITE_GITHUB_BRANCH`，`sync-web-env.mjs` 会优先采用这些值写入 `web/.env.production`。

## 四、API 一览（Pages Functions）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 是否已配置、`varsPresent`（含 `JWT_SECRET`） |
| GET | `/api/auth/me` | 当前登录用户与角色（需 Cookie） |
| POST | `/api/auth/login` | JSON `{ username, password }` |
| POST | `/api/auth/register` | 注册普通用户（受 `registrationEnabled` 控制） |
| POST | `/api/auth/guest` | 访客登录（需管理员开启 `guestEnabled`） |
| POST | `/api/auth/logout` | 清除会话 |
| GET/POST/DELETE | `/api/admin/users` | 管理员：用户列表、添加、删除 |
| POST | `/api/admin/password` | 管理员：重置普通用户密码（写入新哈希，**无法查看**旧明文） |
| GET/PATCH | `/api/admin/settings` | 管理员：`guestEnabled`、`registrationEnabled`、`guestPaths` |
| GET | `/api/list` | 列出 `drive/` 下文件（需登录；隐藏 `.webpan`；访客按白名单过滤） |
| GET | `/api/raw?path=` | 代理文件内容；`download=1` 触发下载响应头 |
| POST | `/api/upload` | `multipart/form-data`，字段 `file`，可选 `path`（访客不可写） |
| DELETE | `/api/file?path=` | 删除文件（访客不可写） |

鉴权：登录成功后由服务端设置 **`HttpOnly` Cookie**（`webpan_session`），浏览器对 `/api/*` 请求需 **`credentials: 'include'`**（前端已配置）。本地非 HTTPS 可设 `COOKIE_SECURE=false` 以便写入 Cookie。

跨域由 `functions/_middleware.js` 与各 handler 统一添加 CORS（含 `Credentials`）。

## 五、限制与说明

- GitHub API 有速率与单文件大小限制；本项目中上传在 Worker 内做了约 **45MB** 的保守限制，过大文件请考虑 Git LFS 或其它存储。
- 目录树使用 **recursive tree**；若仓库极大，`truncated` 可能为 `true`，界面会提示。
- 普通用户密码在仓库中仅存 **PBKDF2 哈希**；管理员重置密码会覆盖为新哈希，**不能反查明文**。更高安全需求可叠加 Cloudflare Access 或 OAuth。
- **切勿**把 `GITHUB_TOKEN` 写进前端代码或公开 `config.js`。

## 六、开源协议

MPL 2.0
