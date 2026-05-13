# A Personal Cloud Storage Deployment Solution Using GitHub Repository as Storage Server + Cloudflare for WebUI Construction (Cloudflare Pages + Functions)

A lightweight personal cloud storage solution that uses the **`drive/` directory of the GitHub repository** for file storage and leverages **Cloudflare Pages + Pages Functions** to provide API services and cross-origin support. The frontend is built with **Vue 3 + Vite + Element Plus**, requiring **no database**.



# This project is only for personal communication and learning. Any abuse is strictly prohibited. Do not store files that violate local laws, internet regulations, engage in commercial use, occupy public resources without authorization, or resell this project. Avoid storing massive numbers of files to prevent excessive pressure on the repository server.

# Disclaimer: This project does not provide any server resources and generates no revenue for project contributors. All risks arising from cloning and using this project shall be borne solely by the cloner.

# For the full deployment guide, please refer to [Guide(EN).md](https://github.com/HuiJiangOfficial/Personal_Pan_LinkedGithub/blob/main/Guide(EN).md)





## Feature Overview

- Recursively list all files under the `drive/` directory (via Git Tree API)
- File upload, download and deletion (via GitHub Contents API)
- Online preview: Common images, PDF documents, text source code, Markdown files, etc. (Content is fetched via authenticated proxy to resolve the issue of password-restricted resources inaccessible to raw `<img>` tags)
- **User Roles**: Administrator (configured via environment variables `ADMIN_USERNAME` / `ADMIN_PASSWORD`), Regular Users (self-registration allowed; credentials stored in `drive/.webpan/system/users.json` with passwords hashed via **PBKDF2-SHA256**), Guest `guest` (password-free; disabled by default with no file visibility; administrators can enable it and configure visible path prefixes)
- Login session management based on **HttpOnly Cookie + JWT** (`JWT_SECRET` is treated as confidential information)
- Responsive layout with horizontally scrollable data tables, compatible with mobile and desktop devices

## Directory Structure

```
.
├── drive/              # Cloud storage file directory (actual file storage area committed to Git)
├── web/                # Frontend project (Vue3 + Vite + Element Plus)
├── functions/          # Cloudflare Pages Functions (backend API service)
├── scripts/
│   └── sync-web-env.mjs   # Synchronize root config to web/.env.production before build
├── config.example.js   # Configuration template (copy to config.js for use)
├── package.json        # Root build script: synchronize environment variables and build frontend
├── wrangler.toml       # Pages configuration and non-confidential environment variables [vars]
                        # Confidential variables are only configured via dashboard secrets
└── README.md
```



## The following is a simplified deployment tutorial. For detailed instructions, please refer to [Guide(EN).md](https://github.com/HuiJiangOfficial/Personal_Pan_LinkedGithub/blob/main/Guide(EN).md)

## 1. GitHub Preparation

1. Clone this repository.
2. Create a **Personal Access Token (classic)** on GitHub, check the **`repo`** scope (mandatory for private repositories; `public_repo` suffices for public repositories).
3. Record your **GitHub username / repository name / default branch** (generally `main`).

## 2. Core Configuration Instructions

### 0. Manage Environment Variables via `wrangler.toml` (Aligned with Dashboard Prompts)

If Cloudflare prompts: **Environment variables are managed by wrangler.toml; only secrets can be configured in the dashboard**, follow the configuration rules below:

| Type | Configuration Location |
|------|------------------------|
| **Non-confidential Variables** | Configure `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` under **`[vars]` in wrangler.toml**; the optional `ADMIN_USERNAME` (default: `admin`) can also be placed in `[vars]` or dashboard environment variables. |
| **Confidential Variables** | **Do not** write `GITHUB_TOKEN`, `JWT_SECRET` and `ADMIN_PASSWORD` into `wrangler.toml`. Configure them in Cloudflare → **Pages Project** → **Environment Variables and Secrets** → **Secrets**; alternatively use `wrangler pages secret put`. |

The Functions runtime reads the **merged environment**: `[vars]` + dashboard secrets. Missing the three GitHub variables will trigger the prompt *Server configuration incomplete* on the webpage; missing `JWT_SECRET` or admin password will disable login authentication (refer to `varsPresent` in `/api/status`).

### 1. Root Directory `config.js` (Optional: Inject Frontend `VITE_*` Variables for Local & Build Environment)

```bash
copy config.example.js config.js   # Windows
# or cp config.example.js config.js
```

Edit the fields in `config.js` as follows:

| Field | Description |
|-------|-------------|
| `GITHUB_OWNER` | GitHub username or organization name |
| `GITHUB_REPO` | Repository name |
| `GITHUB_BRANCH` | Repository branch, default: `main` |
| `GITHUB_TOKEN` | For local development or CI use only; **do not commit to Git** |
| (Do not place here) | `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` are only configured via Cloudflare secrets/variables or `.dev.vars`, refer to above instructions and `.dev.vars.example` |

> **Important**: **Never commit `GITHUB_TOKEN` to Git** (do not write it to `wrangler.toml` / `config.js`). Production environment injects it exclusively via **Cloudflare Secrets**.
> If server configuration is completed via **`wrangler.toml` + Secrets**, the root `config.js` can be omitted entirely. In this case, set `VITE_GITHUB_OWNER`, `VITE_GITHUB_REPO`, `VITE_GITHUB_BRANCH` in Cloudflare **Build Environment Variables** (consistent with `[vars]`) for header repository display; or retain a Token-free `config.js` for `sync-web-env.mjs` to generate `web/.env.production`.

### 2. Local Debugging (Optional)

1. Copy `.dev.vars.example` to `.dev.vars`, fill in the same sensitive variables as `config.js`.
2. Run the following commands in the project root directory:

```bash
cd web && npm install && cd ..
npx wrangler pages dev web -- npm run dev
```

Access the local address displayed in the terminal. This command mounts `functions` under the same origin, allowing the frontend to directly request `/api/*`.

If you only run `cd web && npm run dev`, launch `npx wrangler pages dev web` in another terminal (default port `8788`). Set the environment variable `VITE_PROXY_API=1` before starting Vite, so `web/vite.config.js` proxies all `/api` requests to `http://127.0.0.1:8788`.

## 3. One-Click Deployment on Cloudflare Pages

1. Push this repository to GitHub.
2. Open the [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select the repository and configure the following items:

| Item | Recommended Value |
|------|-------------------|
| **Root directory** | `/` (repository root) |
| **Build command** | `npm run build` |
| **Build output directory** | `web/dist` |
| **Environment variables** | Fill `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` under **`[vars]` in wrangler.toml**; add confidential variables **`GITHUB_TOKEN`, `JWT_SECRET`, `ADMIN_PASSWORD`** (and optional `ADMIN_USERNAME`) in the dashboard. If Build variables are still available in the dashboard, set additional `VITE_GITHUB_*` variables for header display. |

4. After the initial deployment completes, access the assigned **`*.pages.dev`** domain (do not use `*.workers.dev`).

### Dashboard Warning about Wrangler Configuration File

If prompted that **local `wrangler.toml` must align with Pages project settings** or advised against manual editing (recommending downloading the official config), follow the official alignment process:

1. Install Node.js locally and run **`npx wrangler login`**.
2. Execute the command in the **repository root directory** (replace `<PagesProjectName>` with the exact Pages project name in the dashboard):

```bash
npx wrangler pages download config <PagesProjectName>
```

3. If a local `wrangler.toml` already exists and the command asks for overwrite confirmation, follow the prompt or append `--force` (this overwrites local files; back up first via `git stash`).
4. Open the updated `wrangler.toml` and **manually verify** essential configurations, especially **`pages_build_output_dir = "web/dist"`** and `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` under **`[vars]`** (the downloaded config may omit custom `[vars]` entries; add them back if missing).
5. **Confidential variables** such as `GITHUB_TOKEN`, `JWT_SECRET`, `ADMIN_PASSWORD` will **not** be downloaded to the local file; continue managing them via dashboard **Secrets** or `wrangler pages secret put`.
6. After verification, run `git commit` + `git push` to ensure Git-based deployment uses configurations consistent with the production environment.

Official References: [Wrangler `pages download config`](https://developers.cloudflare.com/workers/wrangler/commands/pages/#pages-download-config) (marked **Experimental**)、[Pages Functions with wrangler.toml](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).

> **Build Environment Variables**: If you prefer not to read the repository `config.js` during build, set `VITE_GITHUB_OWNER`, `VITE_GITHUB_REPO`, `VITE_GITHUB_BRANCH` in Cloudflare **Build Environment Variables**. `sync-web-env.mjs` prioritizes these values when writing to `web/.env.production`.

## 4. API Overview (Pages Functions)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Check configuration completion status and `varsPresent` (including `JWT_SECRET`) |
| GET | `/api/auth/me` | Get current logged-in user information and role (Cookie required) |
| POST | `/api/auth/login` | User login with JSON payload `{ username, password }` |
| POST | `/api/auth/register` | Regular user registration (controlled by `registrationEnabled`) |
| POST | `/api/auth/guest` | Guest login (requires administrator enabling `guestEnabled`) |
| POST | `/api/auth/logout` | Clear user session |
| GET/POST/DELETE | `/api/admin/users` | Admin-only: View, add and delete user accounts |
| POST | `/api/admin/password` | Admin-only: Reset regular user password (generates new hash; original plaintext is irreversible) |
| GET/PATCH | `/api/admin/settings` | Admin-only: Configure `guestEnabled`, `registrationEnabled`, `guestPaths` |
| GET | `/api/list` | List files under `drive/` (login required; `.webpan` directory hidden; guests filtered by whitelist paths) |
| GET | `/api/raw?path=` | Proxy file content; set `download=1` to trigger download response headers |
| POST | `/api/upload` | `multipart/form-data` upload with `file` field and optional `path` parameter (write access denied for guests) |
| DELETE | `/api/file?path=` | Delete specified file (write access denied for guests) |

Authentication Mechanism: After successful login, the server sets an **`HttpOnly` Cookie** named `webpan_session`. Frontend requests to `/api/*` must enable **`credentials: 'include'`** (pre-configured in frontend code). Set `COOKIE_SECURE=false` for non-HTTPS local environments to allow Cookie storage.

Cross-origin resource sharing (CORS) with credential support is uniformly configured via `functions/_middleware.js` and individual route handlers.

## 5. Limitations & Notes

- GitHub API enforces rate limits and single file size restrictions. This project sets a conservative upload limit of approximately **45MB** within Worker runtime. Use Git LFS or alternative storage solutions for larger files.
- Directory tree queries use **recursive tree requests**. For oversized repositories, the `truncated` flag may return `true`, with corresponding UI prompts displayed.
- Regular user passwords are stored only as **PBKDF2 hashes** in the repository. Admin password resets generate new hashes with **no plaintext recovery possible**. For enhanced security, integrate Cloudflare Access or OAuth authentication.
- **Never** expose `GITHUB_TOKEN` in frontend code or public `config.js` files.

## 6. Open Source License

MPL 2.0