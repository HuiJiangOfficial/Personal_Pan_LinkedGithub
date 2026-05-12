# GitHub 个人网盘：从零部署指南

本指南面向**第一次克隆本仓库**的用户，说明如何从本地准备代码、配置 GitHub、在 **Cloudflare Pages**（含 **Pages Functions**，运行于 Workers 运行时）上完成部署与变量设置。部署完成后，你将得到一个基于 GitHub 仓库 `drive/` 目录的轻量网盘站点。

> **说明**：本项目使用的是 **Cloudflare Pages + Pages Functions**，不是单独创建一个「纯 Worker」再手动接静态资源。Pages 会托管前端构建产物（`web/dist`），同项目下的 `functions/` 会自动作为 API（`/api/*`）运行。

---

## 一、你需要准备什么

| 项目 | 说明 |
|------|------|
| GitHub 账号 | 用于存放代码与网盘文件 |
| 一个空或已有仓库 | 克隆本模板后推送到你的仓库（可 Fork 或复制文件） |
| Cloudflare 账号 | 免费层即可用于 Pages |
| 本机 Node.js | 建议 **18+**（用于本地构建与可选联调） |
| Git | 克隆、推送代码 |

---

## 二、第一次拿到代码：克隆与目录约定

1. 将本仓库克隆（或 Fork 后克隆）到本机：

```bash
git clone <你的仓库 HTTPS 或 SSH 地址>
cd <仓库目录名>
```

2. 确认仓库根目录存在 **`drive/`** 目录（网盘文件将存放在 `drive/<用户网盘根>/` 下）。若不存在，请新建空目录并提交，否则 GitHub 树 API 行为可能不符合预期。

3. **切勿**将含 `GITHUB_TOKEN`、`JWT_SECRET`、管理员密码的 `config.js` 或 `.dev.vars` 提交到公开 Git。

---

## 三、在 GitHub 创建访问令牌（PAT）

1. 打开 GitHub → **Settings** → **Developer settings** → **Personal access tokens**。  
2. 创建 **classic** token，至少勾选 **`repo`**（私有仓库必选；公开仓库可勾选 `public_repo`）。  
3. 复制生成的 token，**只保存在安全位置**（密码管理器或 Cloudflare 机密），不要写进代码或截图外传。

该 token 由 **Cloudflare Pages Functions** 在服务端调用 GitHub API，用户浏览器得不到它。

---

## 四、本地可选：`config.js` 与构建

1. 复制模板：

```bash
copy config.example.js config.js
```

（Linux / macOS：`cp config.example.js config.js`）

2. 编辑 `config.js`：填写 **`GITHUB_OWNER`**、**`GITHUB_REPO`**、**`GITHUB_BRANCH`**；本地若需联调可把 **`GITHUB_TOKEN`** 写入 `config.js`（**不要 push**）。  
3. 根目录执行构建（会同步前端环境变量并构建 `web/dist`）：

```bash
npm run build
```

若线上**不写** `config.js`，可在 Cloudflare **构建环境变量**中设置 `VITE_GITHUB_OWNER`、`VITE_GITHUB_REPO`、`VITE_GITHUB_BRANCH`（与仓库信息一致），脚本 `scripts/sync-web-env.mjs` 会写入 `web/.env.production`。

---

## 五、Cloudflare Pages：连接 GitHub 并部署

### 5.1 新建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。  
2. 授权 GitHub，选择你的仓库与分支（通常为 `main`）。

### 5.2 构建设置（Build）

### （一开始创建不要错选成创建Worker了！！！如果选成Worker请删除重新找到新建Pages的入口重试）

| 配置项 | 建议值 |
|--------|--------|
| **Root directory** | `/`（仓库根目录） |
| **Build command** | `npm run build` |
| **Build output directory** | `web/dist` |

保存并开始首次部署。此时若仅配置了公开变量，构建可能成功，但 **Functions 缺少机密时登录会失败**，属正常现象，继续下一步。

### 5.3 非机密变量（`[vars]` / 控制台「变量」）

在 **Pages 项目 → Settings → Variables and Secrets** 中，为**生产环境**添加（名称与 `wrangler.toml` 中 `[vars]` 一致即可）：

- `GITHUB_OWNER`：GitHub 用户名或组织名  
- `GITHUB_REPO`：仓库名  
- `GITHUB_BRANCH`：分支名，如 `main`  

可选：`ADMIN_USERNAME`（默认 `admin`）。

也可在仓库根目录维护 `wrangler.toml` 的 `[vars]` / `[env.production.vars]`，与控制台**不要互相矛盾**；机密**不要**写进 `wrangler.toml`。

### 5.4 机密（Secrets）

在 **Variables and Secrets** 里添加 **Secret**（或使用 Wrangler CLI）：

| 机密名 | 作用 |
|--------|------|
| `GITHUB_TOKEN` | 服务端访问 GitHub API |
| `JWT_SECRET` | 签名会话 Cookie（**长随机字符串**，与任何环境勿复用弱口令） |
| `ADMIN_PASSWORD` | 管理员登录密码（仅存环境变量，不写仓库） |

CLI 示例（将 `<项目名>` 换成 Cloudflare 里该 Pages 项目的名称）：

```bash
npx wrangler pages secret put GITHUB_TOKEN --project-name=<项目名>
npx wrangler pages secret put JWT_SECRET --project-name=<项目名>
npx wrangler pages secret put ADMIN_PASSWORD --project-name=<项目名>
```

**添加或修改机密后**：建议在 **Deployments** 中对最新部署执行 **Retry deployment**，确保 Functions 进程读到新环境。

### 5.5 访问域名

部署成功后，使用 Pages 提供的 **`*.pages.dev`** 域名访问。不要在未配置 Pages 的情况下误用 `*.workers.dev` 访问本项目的静态+API 一体站点。

---

## 六、首次登录与管理员

1. 打开站点 → **登录**。  
2. 使用环境变量中的 **`ADMIN_USERNAME` / `ADMIN_PASSWORD`**（默认用户名为 `admin`，除非你已修改）。  
3. 在管理后台可配置：访客开关、注册开关、访客可见路径白名单、用户管理等。

普通用户通过注册写入仓库内 `drive/.webpan/system/users.json`（密码为哈希，不可逆）。

---

## 七、本地联调（可选）

1. 复制 `.dev.vars.example` 为 `.dev.vars`，填写 `GITHUB_TOKEN`、`JWT_SECRET`、`ADMIN_PASSWORD` 等。  
2. 在项目根目录执行：

```bash
cd web && npm install && cd ..
npx wrangler pages dev web -- npm run dev
```

终端会给出本地 URL；同一源下会挂载 `functions/`，前端请求 `/api/*` 可携带 Cookie 调试。

若只跑 Vite，需另起 `wrangler pages dev web` 并配置代理，参见仓库 `README.md`。

---

## 八、安全与运维建议（与功能现实一致）

1. **Token 与 JWT**：`GITHUB_TOKEN`、`JWT_SECRET`、管理员密码仅出现在 Cloudflare 机密或本机 `.dev.vars`，勿提交到 Git。  
2. **HTTPS 与 Cookie**：生产环境为 HTTPS 时 Cookie 带 `Secure`；本地 HTTP 可设 `COOKIE_SECURE=false`（见 `.dev.vars.example`）。  
3. **用户数据边界**：每个登录用户在 GitHub 上对应 `drive/<网盘根>/`；**`.webpan/**` 下文件（含个人背景）不允许通过 `/api/raw` 或通用上传路径访问**，仅能通过专用背景接口由服务端按会话读取，降低路径猜测与误共享风险。  
4. **访客模式**：访客共用 `guest` 会话与 `drive/guest/` 空间，仅白名单路径可读；勿将敏感资料放入该目录。  
5. **速率与体积**：大文件受 GitHub API 限制；上传在 Worker 侧有保守大小上限，超大文件请考虑 Git LFS 或其他存储。

---

## 九、常见问题

| 现象 | 可能原因 |
|------|----------|
| 页面提示服务端未配置 | 检查 `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_TOKEN` 是否在 Pages 环境中生效 |
| 无法登录、401 | 是否未配置 `JWT_SECRET` 或 `ADMIN_PASSWORD`；改机密后是否已重新部署 |
| 构建成功但 API 仍旧 | 对最新部署 **Retry deployment** |
| 控制台提示 wrangler 与线上不一致 | 使用官方 `wrangler pages download config` 对齐后再人工核对 `pages_build_output_dir` 与 `[vars]`（参见 `README.md`） |

---

## 十、更多文档

- 仓库内 **`README.md`**：功能概览、API 列表、目录结构、限制说明。  
- Cloudflare 文档：[Pages Functions](https://developers.cloudflare.com/pages/functions/)、[Wrangler 配置](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)。

若在部署过程中某一步与 Cloudflare 控制台文案略有差异，以你账号当前界面为准，本指南提供的是推荐流程与变量清单。
