/**
 * 错误码与展示文案（与 ErrorDisplay.md 对应；后端 JSON 的 code 优先匹配）
 * severity: critical = 弹窗；warning = 右下角通知；info = 右下角通知；silent = 不展示 UI
 */
export const ERROR_CATALOG = {
  SRV_OK: {
    severity: 'silent',
    title: '',
    message: '',
    solution: '',
  },

  SRV_NOT_CONFIGURED: {
    severity: 'critical',
    title: '服务端未完成 GitHub 相关配置',
    message:
      '当前环境缺少 GITHUB_OWNER、GITHUB_REPO 或 GITHUB_TOKEN 中的一项或多项，Pages Functions 无法访问你的 GitHub 仓库，网盘不可用。',
    solution:
      '1）在 Cloudflare → Pages 项目 → 变量：设置 GITHUB_OWNER、GITHUB_REPO、GITHUB_BRANCH；2）在「机密」添加 GITHUB_TOKEN（classic PAT，需 repo 权限）；3）保存后对最新部署执行 Retry deployment。详见仓库根目录 ErrorDisplay.md。',
  },

  SRV_JWT_NOT_SET: {
    severity: 'critical',
    title: '服务端未配置 JWT 签名密钥',
    message: '已配置 GitHub 变量，但未设置 JWT_SECRET，无法创建登录会话。',
    solution:
      '在 Cloudflare Pages → 机密中添加 JWT_SECRET（建议使用 32 字节以上随机字符串），保存后 Retry deployment。本地联调写入 .dev.vars。',
  },

  SRV_GITHUB_INCOMPLETE: {
    severity: 'critical',
    title: '服务端 GitHub 环境不完整',
    message: '本次请求在服务端检测到 GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN 未全部就绪。',
    solution: '与错误码 SRV_NOT_CONFIGURED 相同，检查变量与机密是否已部署到当前环境。',
  },

  SRV_JWT_SECRET_MISSING: {
    severity: 'critical',
    title: 'JWT 未配置',
    message: '登录接口检测到 JWT_SECRET 未设置。',
    solution: '在 Cloudflare 机密中配置 JWT_SECRET 并重新部署。',
  },

  SRV_UNEXPECTED: {
    severity: 'critical',
    title: '服务器内部错误',
    message: '处理登录或用户数据时出现未预期异常。',
    solution: '查看 Cloudflare Pages Functions 日志与 GitHub API 返回；确认 users.json 未被破坏、仓库权限正常。',
  },

  SRV_LOGIN_FAILED: {
    severity: 'warning',
    title: '登录处理失败',
    message: '服务器在处理登录请求时出错。',
    solution: '稍后重试；检查 Functions 日志与 GitHub 是否可访问 drive/.webpan/system/users.json。',
  },

  AUTH_INVALID_CREDENTIALS: {
    severity: 'warning',
    title: '登录失败',
    message: '用户名或密码不正确。',
    solution: '请核对账号密码；普通用户忘记密码需联系管理员重置；管理员密码来自环境变量 ADMIN_PASSWORD。',
  },

  AUTH_FIELDS_MISSING: {
    severity: 'warning',
    title: '信息不完整',
    message: '请填写用户名和密码。',
    solution: '补全表单后重试。',
  },

  REQ_BODY_NOT_JSON: {
    severity: 'warning',
    title: '请求格式错误',
    message: '请求体不是合法 JSON。',
    solution: '请使用官方页面登录，勿用错误格式的第三方工具调用登录接口。',
  },

  AUTH_SESSION_INVALID: {
    severity: 'critical',
    title: '登录状态无效',
    message: '会话令牌异常或用户标识非法，无法继续访问网盘。',
    solution: '请点击确定后重新登录；若反复出现，请清除本站 Cookie 或检查 JWT_SECRET 是否被更换。',
  },

  AUTH_UNAUTHORIZED: {
    severity: 'warning',
    title: '需要登录',
    message: '当前请求需要有效登录会话。',
    solution: '请重新登录后再试。',
  },

  AUTH_JWT_NOT_CONFIGURED: {
    severity: 'critical',
    title: '服务未就绪',
    message: '服务端未配置 JWT_SECRET，无法完成鉴权。',
    solution: '由管理员配置 JWT_SECRET 机密并重新部署。',
  },

  NET_OFFLINE: {
    severity: 'critical',
    title: '无法连接服务器',
    message: '浏览器无法与网盘 API 建立连接（无响应或网络中断）。',
    solution:
      '检查本机网络、VPN、防火墙；确认站点已部署且 URL 正确；本地开发需同时启动 wrangler pages dev 与前端或配置代理。',
  },

  NET_TIMEOUT: {
    severity: 'warning',
    title: '请求超时',
    message: '请求在限定时间内未完成，常见于大文件上传/下载或 GitHub API 较慢。',
    solution: '稍后重试；缩小文件体积；检查 GitHub 服务状态。',
  },

  HTTP_403: {
    severity: 'warning',
    title: '无权执行此操作',
    message: '服务器拒绝了本次操作（HTTP 403）。',
    solution: '访客仅只读且受路径白名单限制；普通操作需使用非访客账号；背景图等需写权限。',
  },

  HTTP_404: {
    severity: 'warning',
    title: '资源不存在',
    message: '请求的文件或背景在仓库中不存在或已被删除。',
    solution: '刷新列表后重试；重新上传背景或检查路径是否正确。',
  },

  HTTP_413: {
    severity: 'warning',
    title: '文件过大',
    message: '上传内容超过服务端允许的大小。',
    solution: '压缩或拆分文件；网盘背景图须小于 4MB；大文件请考虑 Git LFS 或其它存储。',
  },

  HTTP_429: {
    severity: 'warning',
    title: '请求过于频繁',
    message: '可能触发 GitHub API 速率限制。',
    solution: '等待数分钟后重试；减少并发操作；私有仓库需合理 scope 的 Token。',
  },

  HTTP_502: {
    severity: 'warning',
    title: '上游服务异常',
    message: '从 GitHub 读取或写入失败（网关/上游错误）。',
    solution: '稍后重试；检查 GITHUB_TOKEN 权限与仓库是否存在；查看 Cloudflare / GitHub 状态页。',
  },

  HTTP_503: {
    severity: 'critical',
    title: '服务暂时不可用',
    message: '服务端缺少必要配置或依赖（HTTP 503）。',
    solution: '检查 JWT_SECRET、GitHub 变量与机密是否已注入当前部署环境。',
  },

  HTTP_500: {
    severity: 'critical',
    title: '服务器错误',
    message: '服务端处理请求时发生内部错误。',
    solution: '查看 Pages Functions 日志；确认 users.json 格式正确、仓库分支存在。',
  },

  PREVIEW_FAILED: {
    severity: 'warning',
    title: '预览失败',
    message: '无法加载该文件的预览内容。',
    solution: '尝试下载后本地打开；检查文件是否过大或格式受支持。',
  },

  CLIPBOARD_FAILED: {
    severity: 'warning',
    title: '无法访问剪贴板',
    message: '浏览器拒绝写入剪贴板（权限或安全上下文限制）。',
    solution: '使用 HTTPS 访问；在浏览器设置中允许剪贴板；或按弹窗手动复制。',
  },

  CLIENT_VALIDATION: {
    severity: 'warning',
    title: '输入校验',
    message: '',
    solution: '请按页面提示修正输入。',
  },

  BG_PREVIEW_LOAD_FAILED: {
    severity: 'warning',
    title: '背景原图预览失败',
    message: '无法从服务器加载背景图用于抽屉内预览。',
    solution: '请刷新页面或在外观设置中重新上传背景图；若持续失败，检查登录是否有效。',
  },
};
