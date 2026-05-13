# GitHub Personal Cloud Disk: Full Deployment Guide from Scratch
This guide is intended for users **cloning this repository for the first time**. It explains the process of local code preparation, GitHub configuration, and full deployment along with environment variable setup on **Cloudflare Pages** (including **Pages Functions** running on the Workers runtime). After deployment, you will obtain a lightweight cloud disk website based on the `drive/` directory of your GitHub repository.

This English document is translated by AI. **The Chinese version shall prevail in case of any discrepancy.**

> **Note**: This project adopts **Cloudflare Pages + Pages Functions**, instead of creating a standalone "pure Worker" and manually integrating static resources. Pages hosts the frontend build artifacts located in `web/dist`, while the `functions/` directory within the same project automatically runs as API endpoints (`/api/*`).

# **This project is for personal learning and communication only. Any form of abuse is strictly prohibited. Do not store files that violate local laws or internet regulations. Commercial use, unauthorized occupation of public resources, and resale of this project are forbidden. Avoid storing massive files to prevent excessive pressure on repository servers.**

# **Disclaimer**: This project does not provide any server resources and generates no revenue for project contributors. Users who clone this project shall bear all associated risks entirely on their own.

---

## 1. Prerequisites

| Item | Description |
|------|-------------|
| GitHub Account | For code hosting and cloud disk file storage |
| New or Existing GitHub Repository | Push the cloned template to your own repository (Fork or manually copy files is acceptable) |
| Cloudflare Account | Free tier is sufficient for Cloudflare Pages |
| Local Node.js | Version **18+** recommended (for local build and optional joint debugging) |
| Git | For repository cloning and code pushing |

---

## 2. Initial Code Acquisition: Cloning & Directory Conventions
1. Clone this repository (or clone after Forking) to your local machine:
```bash
git clone <Your repository HTTPS or SSH URL>
cd <Repository directory name>
```

2. Confirm that the **`drive/`** directory exists in the repository root (cloud disk files will be stored under `drive/<user-cloud-disk-root>/`). If the directory does not exist, create an empty one and commit it; otherwise, the GitHub Tree API may behave unexpectedly.

3. **Never** commit `config.js` or `.dev.vars` containing `GITHUB_TOKEN`, `JWT_SECRET`, or admin passwords to the public Git repository.

---

## 3. Create GitHub Personal Access Token (PAT)
1. Navigate to GitHub → **Settings** → **Developer settings** → **Personal access tokens**.
2. Create a **classic** token, and at minimum check the **`repo`** scope (mandatory for private repositories; `public_repo` is sufficient for public repositories).
3. Copy the generated token and **store it securely only** (password manager or Cloudflare Secrets). Do not hardcode it in code or share it via screenshots.

This token is invoked by **Cloudflare Pages Functions** to call the GitHub API on the server side and will never be exposed to user browsers.

---

## 4. Optional Local Configuration: `config.js` & Project Build
1. Copy the configuration template:
```bash
copy config.example.js config.js
```
(Linux / macOS: `cp config.example.js config.js`)

2. Edit `config.js`: Fill in **`GITHUB_OWNER`**, **`GITHUB_REPO`**, and **`GITHUB_BRANCH`**. For local debugging, you may write **`GITHUB_TOKEN`** into `config.js` (**do not push this file remotely**).
3. Run the build command in the root directory (automatically syncs frontend environment variables and builds `web/dist`):
```bash
npm run build
```

If you skip local `config.js` configuration, set `VITE_GITHUB_OWNER`, `VITE_GITHUB_REPO`, and `VITE_GITHUB_BRANCH` in Cloudflare **build environment variables** (consistent with your repository information). The script `scripts/sync-web-env.mjs` will automatically write these variables to `web/.env.production`.

---

## 5. Cloudflare Pages: Connect GitHub & Deploy
### 5.1 Create a New Pages Project
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub access, then select your target repository and branch (usually `main`).

### 5.2 Build Configuration
### **Do NOT mistakenly select Worker during initial creation!!! If you select Worker by accident, delete it and restart the Pages creation process.**

| Configuration Item | Recommended Value |
|--------------------|-------------------|
| **Root directory** | `/` (repository root) |
| **Build command** | `npm run build` |
| **Build output directory** | `web/dist` |

Save settings and start the first deployment. Deployment may succeed with only public environment variables configured, but login will fail due to missing Functions secrets — this is normal, proceed to the next step.

### 5.3 Non-confidential Environment Variables (`[vars]` / Dashboard Variables)
Go to **Pages Project → Settings → Variables and Secrets**, and add the following variables for the production environment (keep names consistent with `[vars]` in `wrangler.toml`):

- `GITHUB_OWNER`: GitHub username or organization name
- `GITHUB_REPO`: Repository name
- `GITHUB_BRANCH`: Branch name, e.g., `main`

Optional: `ADMIN_USERNAME` (default: `admin`).

You may also maintain `[vars]` / `[env.production.vars]` in `wrangler.toml` at the repository root; **do not set conflicting values** between the file and Cloudflare dashboard. Never write sensitive secrets into `wrangler.toml`.

### 5.4 Secrets Configuration
Add the following Secrets in **Variables and Secrets** (or use Wrangler CLI):

| Secret Name | Purpose |
|-------------|---------|
| `GITHUB_TOKEN` | Server-side authentication for GitHub API access |
| `JWT_SECRET` | Sign session cookies (use a long random string; never reuse weak passwords across environments) |
| `ADMIN_PASSWORD` | Administrator login password (store only in environment variables, not in the repository) |

CLI Example (replace `<ProjectName>` with your Cloudflare Pages project name):
```bash
npx wrangler pages secret put GITHUB_TOKEN --project-name=<ProjectName>
npx wrangler pages secret put JWT_SECRET --project-name=<ProjectName>
npx wrangler pages secret put ADMIN_PASSWORD --project-name=<ProjectName>
```

**After adding or modifying secrets**: Go to **Deployments** and select **Retry deployment** for the latest build to ensure Pages Functions loads the updated environment variables.

### 5.5 Access Domain
After successful deployment, visit the site via the official **`*.pages.dev`** domain provided by Cloudflare. Do not use the `*.workers.dev` domain to access this integrated static + API site without proper Pages configuration.

---

## 6. First Login & Admin Panel
1. Access the website and click **Login**.
2. Log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` configured in environment variables (default username is `admin` unless modified manually).
3. In the admin panel, you can configure: guest mode toggle, registration toggle, whitelist of paths accessible to guests, user management, and more.

Regular user registration information is saved to `drive/.webpan/system/users.json` in the repository (passwords are stored as irreversible hashes).

---

## 7. Local Debugging (Optional)
1. Copy `.dev.vars.example` to `.dev.vars`, then fill in `GITHUB_TOKEN`, `JWT_SECRET`, `ADMIN_PASSWORD` and other configurations.
2. Run the following commands in the project root directory:
```bash
cd web && npm install && cd ..
npx wrangler pages dev web -- npm run dev
```

The terminal will provide a local access URL. The `functions/` directory will be mounted under the same origin, allowing frontend debugging with cookies for `/api/*` requests.

If you only run the Vite dev server separately, start `wrangler pages dev web` additionally and configure the proxy; refer to the repository `README.md` for details.

---

## 8. Security & Operation Best Practices
1. **Token & JWT Management**: Keep `GITHUB_TOKEN`, `JWT_SECRET`, and admin passwords only in Cloudflare Secrets or local `.dev.vars`; never commit them to Git.
2. **HTTPS & Cookies**: Cookies are marked as `Secure` in production HTTPS environments. For local HTTP debugging, set `COOKIE_SECURE=false` (refer to `.dev.vars.example`).
3. **User Data Isolation**: Each logged-in user corresponds to an independent `drive/<cloud-disk-root>/` path on GitHub. Files under **`.webpan/`** (including custom backgrounds) are restricted from access via `/api/raw` or public upload endpoints. They can only be read by the server through dedicated background interfaces based on user sessions, mitigating path brute-force and accidental data sharing risks.
4. **Guest Mode**: Guest users share the `guest` session and `drive/guest/` storage space, with access limited only to whitelisted paths. Do not store sensitive files in this directory.
5. **Rate Limit & File Size**: Large file uploads are restricted by GitHub API limits. A conservative file size limit is enforced on the Worker side. For ultra-large files, consider Git LFS or alternative storage solutions.

---

## 9. Troubleshooting

| Phenomenon | Possible Cause |
|------------|----------------|
| Page prompts server-side not configured | Verify that `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_TOKEN` take effect in Pages environment variables |
| Login failed / 401 error | Missing `JWT_SECRET` or `ADMIN_PASSWORD`; no redeployment after secret modification |
| Build succeeded but API unavailable | Perform **Retry deployment** on the latest build |
| Wrangler version mismatch warning in console | Align local and online configurations via `wrangler pages download config`, then manually verify `pages_build_output_dir` and `[vars]` (see `README.md`) |

---

## 10. Additional Documentation
- **`README.md`** in the repository: Feature overview, API list, directory structure, and usage limitations.
- Cloudflare Official Docs: [Pages Functions](https://developers.cloudflare.com/pages/functions/), [Wrangler Configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).

If the Cloudflare dashboard UI differs slightly during deployment, follow the actual interface instructions. This guide provides standardized deployment workflows and environment variable specifications.