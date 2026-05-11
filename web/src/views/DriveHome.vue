<template>
  <el-container class="page">
    <el-header class="header" height="auto">
      <div class="header-row">
        <div class="title-block">
          <h1 class="title">GitHub 个人网盘</h1>
          <p class="subtitle">
            仓库：{{ displayRepo }} · 分支：{{ status.branch || publicConfig.branch }}
            <span v-if="status.truncated" class="warn">（目录树可能被 GitHub 截断）</span>
          </p>
        </div>
        <div class="actions">
          <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadFiles">刷新</el-button>
          <el-upload
            :show-file-list="false"
            :disabled="!status.configured"
            :http-request="handleUpload"
            multiple
          >
            <el-button type="success" :icon="UploadFilled">上传</el-button>
          </el-upload>
          <el-button v-if="status.needPassword" link type="danger" @click="onReLogin">重新登录</el-button>
        </div>
      </div>

      <el-alert
        v-if="!status.configured"
        type="error"
        show-icon
        :closable="false"
        title="服务端未完成配置"
        :description="configAlertDescription"
      />
      <el-alert v-else-if="status.truncated" type="warning" show-icon :closable="false" title="文件数量较多" description="GitHub 返回的目录树可能被截断，建议拆分仓库或精简 drive 目录。" />
    </el-header>

    <el-main class="main">
      <el-card shadow="never" class="card">
        <div class="table-scroll">
          <el-table :data="files" stripe v-loading="loading" empty-text="暂无文件，试试上传吧" style="min-width: 640px">
            <el-table-column prop="name" label="文件名" min-width="160" show-overflow-tooltip />
            <el-table-column prop="path" label="路径" min-width="220" show-overflow-tooltip />
            <el-table-column label="大小" width="110" align="right">
              <template #default="{ row }">{{ formatSize(row.size) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" @click="openPreview(row)">预览</el-button>
                <el-button link type="primary" @click="downloadFile(row)">下载</el-button>
                <el-button link type="danger" @click="removeFile(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </el-main>

    <!-- 访问密码 -->
    <el-dialog v-model="loginVisible" title="访问验证" width="min(92vw, 420px)" :close-on-click-modal="false" @closed="onLoginClosed">
      <p class="hint">请输入站点访问密码（由管理员在环境变量 SITE_PASSWORD 中设置）。</p>
      <el-input v-model="loginPwd" type="password" show-password placeholder="访问密码" @keyup.enter="submitLogin" />
      <template #footer>
        <el-button @click="loginVisible = false">取消</el-button>
        <el-button type="primary" :loading="loginLoading" @click="submitLogin">确定</el-button>
      </template>
    </el-dialog>

    <!-- 预览 -->
    <el-drawer v-model="preview.visible" :title="preview.title" size="min(96vw, 900px)" destroy-on-close @closed="onPreviewClosed">
      <div v-if="preview.kind === 'image'" class="preview-box">
        <img class="preview-img" :src="preview.url" alt="preview" />
      </div>
      <div v-else-if="preview.kind === 'pdf'" class="preview-box preview-pdf">
        <iframe class="preview-frame" title="pdf" :src="preview.url" />
      </div>
      <div v-else-if="preview.kind === 'text'" class="preview-box">
        <el-scrollbar height="calc(100vh - 140px)">
          <pre class="preview-text">{{ preview.text }}</pre>
        </el-scrollbar>
      </div>
      <el-empty v-else description="该文件类型暂不支持在线预览，请下载后查看" />
    </el-drawer>

    <el-footer class="site-footer" height="auto">
      <span class="site-footer__mark">GithubWebPan</span>
    </el-footer>
  </el-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, UploadFilled } from '@element-plus/icons-vue';
import { http, getStoredPassword, setStoredPassword } from '@/api/http.js';
import { publicConfig } from '@/config.js';

const loading = ref(false);
const loginLoading = ref(false);
const loginVisible = ref(false);
const loginPwd = ref('');

const status = reactive({
  configured: true,
  needPassword: false,
  branch: publicConfig.branch,
  truncated: false,
  /** @type {{ GITHUB_OWNER?: boolean, GITHUB_REPO?: boolean, GITHUB_TOKEN?: boolean }} */
  varsPresent: {},
});

const files = ref([]);

const preview = reactive({
  visible: false,
  title: '',
  kind: 'none', // image | pdf | text | none
  url: '',
  text: '',
});

const displayRepo = computed(() => {
  const o = publicConfig.owner;
  const r = publicConfig.repo;
  if (o && r) return `${o}/${r}`;
  return '（构建时未注入仓库名，请检查 config.js 与同步脚本）';
});

/** 根据 /api/status 的 varsPresent 生成排查说明（不暴露密钥） */
const configAlertDescription = computed(() => {
  const v = status.varsPresent || {};
  const o = v.GITHUB_OWNER === true ? '已检测到' : '未检测到';
  const r = v.GITHUB_REPO === true ? '已检测到' : '未检测到';
  const t = v.GITHUB_TOKEN === true ? '已检测到' : '未检测到';
  return [
    `服务端自检（仅是否传入，不含值）：GITHUB_OWNER ${o}；GITHUB_REPO ${r}；GITHUB_TOKEN ${t}。`,
    '处理建议：① 仓库根 wrangler.toml 中同时维护 [vars] 与 [env.production.vars] 内的 OWNER/REPO/BRANCH，并 push；② 在 Pages → 变量和机密 → 为「生产环境」添加机密 GITHUB_TOKEN（名称须完全一致）；③ 添加或修改机密后务必 Retry deployment；④ 仍失败可用本机执行：npx wrangler pages secret put GITHUB_TOKEN --project-name=你的Pages项目名。',
  ].join('');
});

onMounted(async () => {
  await bootstrap();
});

async function bootstrap() {
  try {
    const { data } = await http.get('/api/status');
    status.configured = Boolean(data.configured);
    status.needPassword = Boolean(data.needPassword);
    status.branch = data.branch || status.branch;
    if (data.varsPresent && typeof data.varsPresent === 'object') {
      status.varsPresent = { ...data.varsPresent };
    }

    if (!status.configured) {
      return;
    }

    if (status.needPassword) {
      const saved = getStoredPassword();
      if (saved) {
        const ok = await tryVerify(saved);
        if (!ok) {
          setStoredPassword('');
          loginVisible.value = true;
          return;
        }
      } else {
        loginVisible.value = true;
        return;
      }
    }

    await loadFiles();
  } catch {
    ElMessage.error('无法连接后端 /api/status，请确认使用 wrangler pages dev 或已部署到 Cloudflare Pages');
  }
}

async function tryVerify(pwd) {
  try {
    const { data } = await http.post('/api/verify', { password: pwd });
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

async function submitLogin() {
  loginLoading.value = true;
  try {
    const { data } = await http.post('/api/verify', { password: loginPwd.value });
    if (data?.ok) {
      setStoredPassword(loginPwd.value);
      loginVisible.value = false;
      loginPwd.value = '';
      ElMessage.success('验证通过');
      await loadFiles();
    }
  } catch {
    /* 拦截器已提示 */
  } finally {
    loginLoading.value = false;
  }
}

function onLoginClosed() {
  if (status.needPassword && !getStoredPassword()) {
    ElMessage.warning('未通过验证时无法列出文件');
  }
}

function onReLogin() {
  setStoredPassword('');
  loginVisible.value = true;
}

async function loadFiles() {
  if (!status.configured) return;
  if (status.needPassword && !getStoredPassword()) {
    loginVisible.value = true;
    return;
  }
  loading.value = true;
  try {
    const { data } = await http.get('/api/list');
    files.value = Array.isArray(data.files) ? data.files : [];
    status.truncated = Boolean(data.truncated);
    if (data.branch) status.branch = data.branch;
  } catch (e) {
    if (e?.response?.status === 401) {
      loginVisible.value = true;
    }
  } finally {
    loading.value = false;
  }
}

function formatSize(n) {
  if (n == null || Number.isNaN(Number(n))) return '-';
  const x = Number(n);
  if (x < 1024) return `${x} B`;
  if (x < 1024 * 1024) return `${(x / 1024).toFixed(1)} KB`;
  if (x < 1024 * 1024 * 1024) return `${(x / 1024 / 1024).toFixed(1)} MB`;
  return `${(x / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function previewKindFor(row) {
  const ext = extOf(row.name);
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['txt', 'md', 'json', 'csv', 'log', 'yml', 'yaml', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'vue', 'sh'].includes(ext)) {
    return 'text';
  }
  return 'none';
}

function revokePreviewUrl() {
  if (preview.url && preview.url.startsWith('blob:')) {
    URL.revokeObjectURL(preview.url);
  }
  preview.url = '';
}

function onPreviewClosed() {
  revokePreviewUrl();
  preview.text = '';
  preview.kind = 'none';
}

async function openPreview(row) {
  const kind = previewKindFor(row);
  preview.title = row.name;
  preview.visible = true;
  preview.kind = kind;

  revokePreviewUrl();
  preview.text = '';

  if (kind === 'none') return;

  try {
    const res = await http.get('/api/raw', {
      params: { path: row.path },
      responseType: kind === 'text' ? 'text' : 'blob',
    });

    if (kind === 'text') {
      preview.text = typeof res.data === 'string' ? res.data : String(res.data);
      return;
    }

    const blob = res.data;
    preview.url = URL.createObjectURL(blob);
  } catch {
    preview.kind = 'none';
    ElMessage.error('预览失败');
  }
}

async function downloadFile(row) {
  try {
    const res = await http.get('/api/raw', {
      params: { path: row.path, download: 1 },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = row.name || 'download';
    a.rel = 'noopener';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    ElMessage.error('下载失败');
  }
}

async function removeFile(row) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.path}」吗？此操作会写入 GitHub 提交记录。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await http.delete('/api/file', { params: { path: row.path } });
    ElMessage.success('已删除');
    await loadFiles();
  } catch {
    /* 错误提示 */
  }
}

async function handleUpload(option) {
  const { file, onError, onSuccess } = option;
  const fd = new FormData();
  fd.append('file', file);
  // 可选：自定义相对路径（此处使用默认文件名）
  try {
    await http.post('/api/upload', fd);
    ElMessage.success(`上传成功：${file.name}`);
    onSuccess?.();
    await loadFiles();
  } catch (e) {
    onError?.(e);
  }
}
</script>

<style scoped>
.page {
  min-height: 100%;
  flex-direction: column;
}

.header {
  padding: 16px 16px 8px;
}

.header-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.title {
  margin: 0 0 6px;
  font-size: 22px;
  line-height: 1.2;
}

.subtitle {
  margin: 0;
  color: #606266;
  font-size: 13px;
}

.warn {
  color: #e6a23c;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.main {
  padding: 8px 16px 24px;
}

.card {
  border-radius: 12px;
}

.hint {
  margin: 0 0 12px;
  color: #606266;
  font-size: 14px;
}

.preview-box {
  height: calc(100vh - 120px);
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

.preview-pdf,
.preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
}

.preview-text {
  margin: 0;
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 768px) {
  .title {
    font-size: 18px;
  }
}

.site-footer {
  padding: 8px 16px 16px;
  text-align: center;
}

.site-footer__mark {
  font-size: 12px;
  color: #909399;
}
</style>
