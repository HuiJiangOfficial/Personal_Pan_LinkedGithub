/**
 * 个人网盘统一配置模板
 *
 * 使用方式：
 * 1. 复制本文件为项目根目录的 config.js
 * 2. 填写下方各项；不要将 config.js 提交到 Git
 * 3. Cloudflare Pages 控制台「设置 → 环境变量」中，添加同名变量（生产环境）
 *    以便 Pages Functions 在云端读取；构建前端时也会用 config.js 注入公开项
 *
 * 说明：GITHUB_TOKEN 与 SITE_PASSWORD 仅应在服务端使用，勿写入前端打包结果。
 */

export default {
  /** GitHub 用户名或组织名 */
  GITHUB_OWNER: 'your-github-username',

  /** 仓库名（本仓库，需包含 /drive 目录） */
  GITHUB_REPO: 'GithubWebPan',

  /**
   * 分支名，默认 main；若仓库默认分支不同请修改
   */
  GITHUB_BRANCH: 'main',

  /**
   * GitHub Personal Access Token（classic）
   * 权限至少需要：repo（私有仓库）或 public_repo（公开仓库）
   * 线上请仅在 Cloudflare 环境变量中配置，勿写入可被前端读取的位置
   */
  GITHUB_TOKEN: 'ghp_xxxxxxxxxxxxxxxxxxxx',

  /**
   * 访问站点时的简单密码（明文比对，仅防随手访问）
   * 线上请使用 Cloudflare 环境变量 SITE_PASSWORD
   */
  SITE_PASSWORD: 'your-access-password',
};
