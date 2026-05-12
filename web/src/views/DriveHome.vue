<template>
  <el-container class="page" :class="{ 'page--mobile': isMobile }">
    <el-header class="header" height="auto">
      <div class="hero">
        <div class="hero__text">
          <div class="hero__badge">
            <el-icon><FolderOpened /></el-icon>
            <span>Drive</span>
          </div>
          <h1 class="title">GitHub 个人网盘</h1>
          <p class="subtitle">
            <span class="subtitle__repo">{{ displayRepo }}</span>
            <el-divider direction="vertical" class="subtitle__div" />
            <span>分支 {{ status.branch || publicConfig.branch }}</span>
            <el-tag v-if="status.truncated" type="warning" size="small" effect="plain" class="subtitle__tag">树可能被截断</el-tag>
            <el-tag v-if="me.role" type="info" size="small" effect="plain" class="subtitle__tag">{{ roleLabel }}</el-tag>
          </p>
        </div>
        <div class="hero__actions">
          <el-tooltip content="深色模式" placement="bottom">
            <el-button :icon="isDark ? Sunny : Moon" circle @click="toggleDark" />
          </el-tooltip>
          <el-button v-if="me.role === 'admin'" type="warning" plain @click="goAdmin">管理后台</el-button>
          <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadFiles">刷新</el-button>
          <el-upload
            :show-file-list="false"
            :disabled="!canMutateDrive"
            :http-request="handleUpload"
            multiple
            class="upload-inline"
          >
            <el-button type="success" :icon="UploadFilled">选择文件</el-button>
          </el-upload>
          <el-button link type="danger" @click="logout">退出登录</el-button>
        </div>
      </div>

      <el-alert
        v-if="!status.configured"
        type="error"
        show-icon
        :closable="false"
        title="服务端未完成配置"
        :description="configAlertDescription"
        class="alert-block"
      />
      <el-alert
        v-else-if="status.truncated"
        type="warning"
        show-icon
        :closable="false"
        title="文件数量较多"
        description="GitHub 返回的目录树可能被截断，建议拆分仓库或精简 drive 目录。"
        class="alert-block"
      />

      <div v-if="status.configured" class="toolbar" :class="{ 'toolbar--sticky': isMobile }">
        <div class="toolbar__row">
          <el-input
            v-model="keyword"
            clearable
            placeholder="搜索文件名或路径…"
            :prefix-icon="Search"
            class="toolbar__search"
          />
          <el-select v-model="sortKey" placeholder="排序" class="toolbar__sort">
            <el-option label="名称 A→Z" value="name-asc" />
            <el-option label="名称 Z→A" value="name-desc" />
            <el-option label="大小 小→大" value="size-asc" />
            <el-option label="大小 大→小" value="size-desc" />
          </el-select>
        </div>
        <div class="toolbar__row toolbar__row--secondary">
          <el-input
            v-model="uploadSubfolder"
            clearable
            placeholder="上传到子目录（可选，如 images 或 docs）"
            class="toolbar__subfolder"
          />
          <div class="toolbar__stats">
            <el-tag type="info" effect="plain">{{ stats.count }} 个文件</el-tag>
            <el-tag type="success" effect="plain">合计 {{ formatSize(stats.totalBytes) }}</el-tag>
            <el-tag v-if="keyword.trim()" type="warning" effect="plain">筛选 {{ displayFiles.length }} 项</el-tag>
            <el-tag v-if="hasDriveClipboard" type="primary" effect="light" class="clip-tag">{{ driveClipboardLabel }}</el-tag>
            <el-button
              v-if="hasDriveClipboard && canMutateDrive"
              type="primary"
              plain
              size="small"
              :icon="DocumentAdd"
              :loading="pasteBusy"
              @click="pasteIntoToolbarDir"
            >
              粘贴到当前子目录
            </el-button>
            <el-button v-if="hasDriveClipboard" text type="info" size="small" @click="clearClip">清空剪贴板</el-button>
          </div>
        </div>
      </div>
    </el-header>

    <el-main class="main">
      <el-card v-if="status.configured" class="card" shadow="hover">
        <!-- 桌面：表格 -->
        <div v-if="!isMobile" class="table-wrap" @contextmenu.prevent="onTableWrapContextMenu">
          <el-table
            :data="displayFiles"
            stripe
            v-loading="loading"
            empty-text="暂无文件，试试上传或调整搜索条件"
            row-key="path"
            class="data-table"
            @row-contextmenu="onRowContextMenu"
          >
            <el-table-column label="" width="52" align="center">
              <template #default="{ row }">
                <el-icon :size="22" class="type-icon" :class="'type-icon--' + fileCategory(row)">
                  <component :is="iconForFile(row)" />
                </el-icon>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="文件名" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="file-name">{{ row.name }}</span>
                <el-tag size="small" class="ext-tag" effect="plain">{{ extOf(row.name) || '—' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="path" label="路径" min-width="200" show-overflow-tooltip />
            <el-table-column label="大小" width="110" align="right">
              <template #default="{ row }">{{ formatSize(row.size) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" @click="openPreview(row)">预览</el-button>
                <el-button link type="primary" @click="downloadFile(row)">下载</el-button>
                <el-button link type="primary" @click="copyPath(row)">复制路径</el-button>
                <el-button v-if="canMutateDrive" link type="danger" @click="removeFile(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 移动端：卡片列表 -->
        <div v-else class="mobile-list" v-loading="loading">
          <template v-if="!displayFiles.length && !loading">
            <el-empty description="暂无文件，试试上传或调整搜索" />
          </template>
          <transition-group name="list-fade" tag="div">
            <div
              v-for="row in displayFiles"
              :key="row.path"
              class="m-card"
              :class="{ 'm-card--tap': previewKindFor(row) !== 'none' }"
              @click="onMobileCardTap(row)"
            >
              <div class="m-card__icon">
                <el-icon :size="28" :class="'type-icon--' + fileCategory(row)">
                  <component :is="iconForFile(row)" />
                </el-icon>
              </div>
              <div class="m-card__body">
                <div class="m-card__title">{{ row.name }}</div>
                <div class="m-card__path">{{ row.path }}</div>
                <div class="m-card__meta">
                  <el-tag size="small" effect="plain">{{ formatSize(row.size) }}</el-tag>
                  <el-tag v-if="extOf(row.name)" size="small" type="info" effect="plain">{{ extOf(row.name) }}</el-tag>
                </div>
              </div>
              <div class="m-card__ops" @click.stop>
                <el-dropdown trigger="click" @command="(cmd) => onMobileCommand(cmd, row)">
                  <el-button type="primary" plain size="small" class="m-card__more">
                    操作
                    <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="preview">预览</el-dropdown-item>
                      <el-dropdown-item command="download">下载</el-dropdown-item>
                      <el-dropdown-item divided command="copyInternal">复制到剪贴板</el-dropdown-item>
                      <el-dropdown-item v-if="canMutateDrive" command="cutInternal">剪切</el-dropdown-item>
                      <el-dropdown-item v-if="canMutateDrive && hasDriveClipboard" command="pasteParent">粘贴到所在目录</el-dropdown-item>
                      <el-dropdown-item v-if="canMutateDrive && hasDriveClipboard" command="pasteRoot">粘贴到根目录</el-dropdown-item>
                      <el-dropdown-item divided command="copy">复制路径</el-dropdown-item>
                      <el-dropdown-item command="copyName">复制文件名</el-dropdown-item>
                      <el-dropdown-item command="props">属性</el-dropdown-item>
                      <el-dropdown-item v-if="canMutateDrive" command="setTarget">设为上传子目录</el-dropdown-item>
                      <el-dropdown-item v-if="canMutateDrive" command="delete" divided type="danger">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </transition-group>
        </div>
      </el-card>

      <!-- 未配置时的占位 -->
      <el-card v-else class="card card--muted" shadow="never">
        <el-empty description="完成服务端配置后即可使用网盘" />
      </el-card>

      <!-- 移动端拖拽上传区 -->
      <el-card v-if="status.configured && isMobile" class="card card--upload" shadow="never">
        <div class="drag-hint">将文件拖到下方区域上传（多文件支持）</div>
        <el-upload
          drag
          multiple
          :show-file-list="false"
          :disabled="!canMutateDrive"
          :http-request="handleUpload"
          class="upload-drag"
        >
          <el-icon class="upload-drag__icon"><UploadFilled /></el-icon>
          <div class="upload-drag__text">点击或拖拽文件到此处</div>
        </el-upload>
      </el-card>
    </el-main>

    <el-drawer
      v-model="preview.visible"
      :title="preview.title"
      :size="isMobile ? '100%' : 'min(96vw, 900px)'"
      destroy-on-close
      direction="rtl"
      class="preview-drawer"
      @closed="onPreviewClosed"
    >
      <div v-if="preview.row" class="preview-toolbar">
        <el-button size="small" type="primary" :icon="Download" @click="downloadFile(preview.row)">下载</el-button>
        <el-button size="small" :icon="DocumentCopy" @click="copyPath(preview.row)">复制路径</el-button>
      </div>
      <div v-if="preview.kind === 'image'" class="preview-box">
        <img class="preview-img" :src="preview.url" alt="preview" />
      </div>
      <div v-else-if="preview.kind === 'pdf'" class="preview-box preview-pdf">
        <iframe class="preview-frame" title="pdf" :src="preview.url" />
      </div>
      <div v-else-if="preview.kind === 'text'" class="preview-box">
        <el-scrollbar :max-height="previewScrollHeight">
          <pre class="preview-text">{{ preview.text }}</pre>
        </el-scrollbar>
      </div>
      <el-empty v-else-if="preview.visible && preview.kind === 'none' && preview.triedOpen" description="该文件类型暂不支持在线预览，请下载后查看" />
    </el-drawer>

    <el-footer class="site-footer" height="auto">
      <span class="site-footer__mark">GithubWebPan</span>
    </el-footer>

    <TransferDock />
    <el-backtop :right="isMobile ? 16 : 24" :bottom="backtopBottom" />

    <DriveContextMenu v-model="ctxOpen" :x="ctxX" :y="ctxY" :items="ctxItems" @pick="onCtxPick" />

    <el-dialog v-model="propsOpen" title="属性" width="min(420px, 92vw)" destroy-on-close class="props-dialog">
      <dl v-if="propsRow" class="props-dl">
        <div class="props-row">
          <dt>文件名</dt>
          <dd>{{ propsRow.name }}</dd>
        </div>
        <div class="props-row">
          <dt>路径</dt>
          <dd class="props-mono">{{ propsRow.path }}</dd>
        </div>
        <div class="props-row">
          <dt>大小</dt>
          <dd>{{ formatSize(propsRow.size) }}</dd>
        </div>
        <div class="props-row">
          <dt>类型</dt>
          <dd>{{ fileTypeLabel(propsRow) }}</dd>
        </div>
        <div v-if="propsRow.sha" class="props-row">
          <dt>SHA</dt>
          <dd class="props-mono props-break">{{ propsRow.sha }}</dd>
        </div>
      </dl>
      <template #footer>
        <el-button type="primary" @click="propsOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Refresh,
  UploadFilled,
  Search,
  Moon,
  Sunny,
  FolderOpened,
  Document,
  PictureFilled,
  Notebook,
  VideoPlay,
  Headset,
  Files,
  ArrowDown,
  Download,
  DocumentCopy,
  View,
  CopyDocument,
  Switch,
  DocumentAdd,
  InfoFilled,
  Delete,
  RefreshRight,
} from '@element-plus/icons-vue';
import { http } from '@/api/http.js';
import { publicConfig } from '@/config.js';
import { createTransferTask, transferState } from '@/composables/transferTasks.js';
import {
  driveClipboard,
  driveClipboardLabel,
  hasDriveClipboard,
  setDriveClipboard,
  clearDriveClipboard,
} from '@/composables/driveClipboard.js';
import TransferDock from '@/components/TransferDock.vue';
import DriveContextMenu from '@/components/DriveContextMenu.vue';

const router = useRouter();
const DARK_KEY = 'github_web_pan_dark';

const loading = ref(false);
const isMobile = ref(false);
const isDark = ref(false);
const keyword = ref('');
const sortKey = ref('name-asc');
const uploadSubfolder = ref('');

const pasteBusy = ref(false);
const ctxOpen = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);
/** @type {import('vue').Ref<any[]>} */
const ctxItems = ref([]);
/** @type {import('vue').Ref<null | { path: string, name: string, size?: number|null, sha?: string|null }>} */
const ctxRow = ref(null);
const propsOpen = ref(false);
/** @type {import('vue').Ref<null | { path: string, name: string, size?: number|null, sha?: string|null }>} */
const propsRow = ref(null);

const status = reactive({
  configured: true,
  branch: publicConfig.branch,
  truncated: false,
  varsPresent: {},
});

const me = reactive({
  user: '',
  role: /** @type {''|'admin'|'user'|'guest'} */ (''),
});

const files = ref([]);

const preview = reactive({
  visible: false,
  title: '',
  kind: 'none',
  url: '',
  text: '',
  /** @type {null | { path: string, name: string, size?: number|null }} */
  row: null,
  triedOpen: false,
});

let mql;

const previewScrollHeight = computed(() => {
  if (typeof window === 'undefined') return '70vh';
  return isMobile.value ? 'calc(100dvh - 200px)' : 'calc(100vh - 200px)';
});

/** 为底部传输条留出空间，避免与「回到顶部」重叠 */
const backtopBottom = computed(() => {
  const dock = transferState.tasks.length > 0;
  if (isMobile.value) return dock ? 220 : 88;
  return dock ? 100 : 56;
});

const displayRepo = computed(() => {
  const o = publicConfig.owner;
  const r = publicConfig.repo;
  if (o && r) return `${o}/${r}`;
  return '（构建时未注入仓库名）';
});

const canMutateDrive = computed(() => status.configured && me.role !== 'guest');

const roleLabel = computed(() => {
  if (me.role === 'admin') return '管理员';
  if (me.role === 'user') return `用户 · ${me.user}`;
  if (me.role === 'guest') return '访客（只读·白名单）';
  return '';
});

const configAlertDescription = computed(() => {
  const v = status.varsPresent || {};
  const o = v.GITHUB_OWNER === true ? '已检测到' : '未检测到';
  const r = v.GITHUB_REPO === true ? '已检测到' : '未检测到';
  const t = v.GITHUB_TOKEN === true ? '已检测到' : '未检测到';
  const j = v.JWT_SECRET === true ? '已检测到' : '未检测到';
  return [
    `服务端自检：GITHUB_OWNER ${o}；GITHUB_REPO ${r}；GITHUB_TOKEN ${t}；JWT_SECRET ${j}。`,
    '请在机密中配置 JWT_SECRET、ADMIN_USERNAME、ADMIN_PASSWORD；并检查 wrangler.toml 与 GitHub Token。',
  ].join('');
});

const stats = computed(() => {
  const list = files.value;
  const totalBytes = list.reduce((s, f) => s + (Number(f.size) || 0), 0);
  return { count: list.length, totalBytes };
});

const displayFiles = computed(() => {
  let list = [...files.value];
  const k = keyword.value.trim().toLowerCase();
  if (k) {
    list = list.filter((f) => f.name.toLowerCase().includes(k) || String(f.path).toLowerCase().includes(k));
  }
  const sk = sortKey.value || 'name-asc';
  const [field, dir] = sk.split('-');
  list.sort((a, b) => {
    if (field === 'name') {
      const cmp = a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base' });
      return dir === 'asc' ? cmp : -cmp;
    }
    const sa = Number(a.size) || 0;
    const sb = Number(b.size) || 0;
    return dir === 'asc' ? sa - sb : sb - sa;
  });
  return list;
});

function syncMobile() {
  isMobile.value = window.matchMedia('(max-width: 767px)').matches;
}

function toggleDark() {
  isDark.value = !isDark.value;
}

watch(
  isDark,
  (v) => {
    document.documentElement.classList.toggle('dark', v);
    try {
      localStorage.setItem(DARK_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  },
  { immediate: true }
);

onMounted(async () => {
  try {
    isDark.value = localStorage.getItem(DARK_KEY) === '1';
  } catch {
    isDark.value = false;
  }
  document.documentElement.classList.toggle('dark', isDark.value);

  syncMobile();
  mql = window.matchMedia('(max-width: 767px)');
  mql.addEventListener('change', syncMobile);

  await bootstrap();
});

onUnmounted(() => {
  if (mql) mql.removeEventListener('change', syncMobile);
});

async function bootstrap() {
  try {
    const { data } = await http.get('/api/status');
    status.configured = Boolean(data.configured);
    status.branch = data.branch || status.branch;
    if (data.varsPresent && typeof data.varsPresent === 'object') {
      status.varsPresent = { ...data.varsPresent };
    }

    if (!status.configured) {
      return;
    }

    const meRes = await http.get('/api/auth/me');
    if (meRes.data?.authenticated) {
      me.user = meRes.data.user || '';
      me.role = meRes.data.role || '';
    }

    await loadFiles();
  } catch {
    ElMessage.error('无法连接后端，请确认已部署到 Cloudflare Pages');
  }
}

async function logout() {
  try {
    await http.post('/api/auth/logout');
  } catch {
    /* ignore */
  }
  me.user = '';
  me.role = '';
  await router.push('/login');
}

function goAdmin() {
  router.push('/admin');
}

async function loadFiles() {
  if (!status.configured) return;
  loading.value = true;
  try {
    const { data } = await http.get('/api/list');
    files.value = Array.isArray(data.files) ? data.files : [];
    status.truncated = Boolean(data.truncated);
    if (data.branch) status.branch = data.branch;
  } catch (e) {
    if (e?.response?.status === 401) {
      await router.replace('/login');
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

function fileCategory(row) {
  const ext = extOf(row.name);
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return 'audio';
  if (['txt', 'md', 'json', 'csv', 'log', 'yml', 'yaml', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'vue', 'sh'].includes(ext)) {
    return 'text';
  }
  return 'file';
}

function iconForFile(row) {
  const c = fileCategory(row);
  if (c === 'image') return PictureFilled;
  if (c === 'pdf' || c === 'text') return Notebook;
  if (c === 'video') return VideoPlay;
  if (c === 'audio') return Headset;
  if (c === 'file') return Files;
  return Document;
}

function previewKindFor(row) {
  const c = fileCategory(row);
  if (c === 'image') return 'image';
  if (c === 'pdf') return 'pdf';
  if (c === 'text') return 'text';
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
  preview.row = null;
  preview.triedOpen = false;
}

async function openPreview(row) {
  const kind = previewKindFor(row);
  preview.row = row;
  preview.title = row.name;
  preview.triedOpen = true;

  revokePreviewUrl();
  preview.text = '';

  if (kind === 'none') {
    preview.kind = 'none';
    preview.visible = true;
    ElMessage.info('该类型不支持在线预览，可在抽屉内下载');
    return;
  }

  preview.kind = kind;
  preview.visible = true;

  try {
    const res = await http.get('/api/raw', {
      params: { path: row.path },
      responseType: kind === 'text' ? 'text' : 'blob',
    });

    if (kind === 'text') {
      preview.text = typeof res.data === 'string' ? res.data : String(res.data);
      return;
    }

    preview.url = URL.createObjectURL(res.data);
  } catch {
    revokePreviewUrl();
    preview.kind = 'none';
    ElMessage.error('预览失败');
  }
}

async function downloadFile(row) {
  const ctrl = createTransferTask({ type: 'download', name: row.name || row.path });
  try {
    const res = await http.get('/api/raw', {
      params: { path: row.path, download: 1 },
      responseType: 'blob',
      onDownloadProgress(ev) {
        const total = ev.total != null && ev.total > 0 ? ev.total : null;
        ctrl.updateProgress(ev.loaded, total);
      },
    });
    const blob = res.data;
    if (blob && typeof blob.size === 'number' && blob.size > 0) {
      ctrl.updateProgress(blob.size, blob.size);
    }
    ctrl.success();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = row.name || 'download';
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    ElMessage.success(`已保存：${row.name || 'download'}`);
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || '下载失败';
    ctrl.fail(msg);
    ElMessage.error(typeof msg === 'string' ? msg : '下载失败');
  }
}

async function copyPath(row) {
  const p = row.path;
  try {
    await navigator.clipboard.writeText(p);
    ElMessage.success('已复制路径');
  } catch {
    ElMessageBox.alert(p, '路径（请手动复制）', { confirmButtonText: '关闭' });
  }
}

async function copyFileName(row) {
  const n = row.name || '';
  try {
    await navigator.clipboard.writeText(n);
    ElMessage.success('已复制文件名');
  } catch {
    ElMessageBox.alert(n, '文件名（请手动复制）', { confirmButtonText: '关闭' });
  }
}

function parentDir(relPath) {
  const s = String(relPath || '');
  const i = s.lastIndexOf('/');
  return i < 0 ? '' : s.slice(0, i);
}

function fileTypeLabel(row) {
  const c = fileCategory(row);
  const map = { image: '图片', pdf: 'PDF', text: '文本', video: '视频', audio: '音频', file: '文件' };
  return map[c] || '文件';
}

function clearClip() {
  clearDriveClipboard();
  ElMessage.info('已清空剪贴板');
}

function clipOne(row) {
  return [{ path: row.path, name: row.name, size: row.size ?? null, sha: row.sha ?? null }];
}

function doCopyInternal(row) {
  setDriveClipboard('copy', clipOne(row));
  ElMessage.success('已复制到剪贴板（可粘贴到其它目录）');
}

function doCutInternal(row) {
  if (!canMutateDrive.value) return;
  setDriveClipboard('cut', clipOne(row));
  ElMessage.success('已剪切（粘贴后将从原位置移除）');
}

/**
 * @param {string} targetDir 不含首尾斜杠，'' 表示根
 * @param {string} baseName
 * @param {Set<string>} reserved
 * @param {string | null} excludePath 剪切时与源路径相同视为可占用
 */
function uniqueDestRel(targetDir, baseName, reserved, excludePath) {
  const join = (dir, name) => (dir ? `${dir}/${name}` : name);
  let stem = baseName;
  let ext = '';
  const dot = baseName.lastIndexOf('.');
  if (dot > 0 && dot < baseName.length - 1) {
    stem = baseName.slice(0, dot);
    ext = baseName.slice(dot);
  }
  let n = 0;
  for (;;) {
    const name = n === 0 ? baseName : `${stem} (${n})${ext}`;
    const rel = join(targetDir, name);
    const occupied = reserved.has(rel);
    if (!occupied) return rel;
    if (excludePath && rel === excludePath) return rel;
    n += 1;
    if (n > 500) throw new Error('无法生成不冲突的文件名');
  }
}

async function pasteIntoDirectory(targetDir) {
  if (!hasDriveClipboard.value || !canMutateDrive.value) {
    ElMessage.warning('剪贴板为空或当前账号不可写入');
    return;
  }
  const mode = driveClipboard.mode;
  const items = [...driveClipboard.items];
  if (!items.length) return;

  const reserved = new Set(files.value.map((f) => f.path));
  /** @type {{ item: typeof items[0], destRel: string }[]} */
  const plan = [];
  for (const item of items) {
    const baseName = item.name || (item.path.includes('/') ? item.path.slice(item.path.lastIndexOf('/') + 1) : item.path);
    const exclude = mode === 'cut' ? item.path : null;
    const destRel = uniqueDestRel(targetDir, baseName, reserved, exclude);
    if (mode === 'cut' && destRel === item.path) {
      ElMessage.warning(`已跳过与源相同的路径：${item.path}`);
      continue;
    }
    reserved.add(destRel);
    plan.push({ item, destRel });
  }
  if (!plan.length) return;

  pasteBusy.value = true;
  try {
    for (const { item, destRel } of plan) {
      const destName = destRel.includes('/') ? destRel.slice(destRel.lastIndexOf('/') + 1) : destRel;
      const dir = destRel.includes('/') ? destRel.slice(0, destRel.lastIndexOf('/')) : '';
      const ctrl = createTransferTask({ type: 'upload', name: destName });
      try {
        const res = await http.get('/api/raw', { params: { path: item.path }, responseType: 'blob' });
        const blob = res.data;
        const file = new File([blob], destName, { type: blob.type || 'application/octet-stream' });
        const fd = new FormData();
        fd.append('file', file);
        if (dir) fd.append('path', `${dir}/`);
        await http.post('/api/upload', fd, {
          timeout: 300000,
          onUploadProgress(ev) {
            const total = ev.total != null && ev.total > 0 ? ev.total : null;
            ctrl.updateProgress(ev.loaded, total);
          },
        });
        if (blob && typeof blob.size === 'number' && blob.size > 0) {
          ctrl.updateProgress(blob.size, blob.size);
        }
        ctrl.success();
      } catch (e) {
        const msg = e?.response?.data?.error || e?.message || '粘贴失败';
        ctrl.fail(typeof msg === 'string' ? msg : '粘贴失败');
        throw e;
      }
    }

    if (mode === 'cut') {
      for (const { item } of plan) {
        await http.delete('/api/file', { params: { path: item.path } });
      }
    }
    clearDriveClipboard();
    ElMessage.success('粘贴完成');
    await loadFiles();
  } catch {
    /* 已提示 */
  } finally {
    pasteBusy.value = false;
  }
}

async function pasteIntoToolbarDir() {
  await pasteIntoDirectory(uploadSubfolder.value.trim());
}

function openProps(row) {
  propsRow.value = row;
  propsOpen.value = true;
}

function openCtx(x, y) {
  ctxX.value = x;
  ctxY.value = y;
  ctxOpen.value = true;
}

function buildRowCtxItems(row) {
  const canPrev = previewKindFor(row) !== 'none';
  const pdir = parentDir(row.path);
  const pLabel = pdir ? `粘贴到「${pdir}」` : '粘贴到根目录';
  return [
    { key: 'preview', label: '预览', icon: View, show: canPrev },
    { key: 'download', label: '下载', icon: Download },
    { type: 'divider' },
    { key: 'copyI', label: '复制', icon: CopyDocument, shortcut: '内部' },
    { key: 'cutI', label: '剪切', icon: Switch, disabled: !canMutateDrive.value },
    {
      key: 'pasteP',
      label: pLabel,
      icon: DocumentAdd,
      disabled: !canMutateDrive.value || !hasDriveClipboard.value,
    },
    {
      key: 'pasteR',
      label: '粘贴到网盘根目录',
      icon: FolderOpened,
      disabled: !canMutateDrive.value || !hasDriveClipboard.value,
    },
    { type: 'divider' },
    { key: 'copyPath', label: '复制路径', icon: DocumentCopy },
    { key: 'copyName', label: '复制文件名', icon: DocumentCopy },
    { key: 'setDir', label: '将上传子目录设为所在文件夹', icon: FolderOpened },
    { type: 'divider' },
    { key: 'props', label: '属性', icon: InfoFilled },
    { type: 'divider' },
    { key: 'delete', label: '删除', icon: Delete, danger: true, disabled: !canMutateDrive.value },
  ];
}

function buildBlankCtxItems() {
  const sub = uploadSubfolder.value.trim();
  const subLabel = sub ? `粘贴到「${sub}」` : '粘贴到当前子目录（根）';
  return [
    {
      key: 'pasteT',
      label: subLabel,
      icon: DocumentAdd,
      disabled: !canMutateDrive.value || !hasDriveClipboard.value,
    },
    {
      key: 'pasteR',
      label: '粘贴到网盘根目录',
      icon: FolderOpened,
      disabled: !canMutateDrive.value || !hasDriveClipboard.value,
    },
    { type: 'divider' },
    { key: 'reload', label: '刷新', icon: RefreshRight },
  ];
}

function onRowContextMenu(row, _col, e) {
  e.preventDefault();
  e.stopPropagation();
  ctxRow.value = row;
  ctxItems.value = buildRowCtxItems(row);
  openCtx(e.clientX, e.clientY);
}

function onTableWrapContextMenu(e) {
  if (e.target.closest?.('.el-table__row')) return;
  ctxRow.value = null;
  ctxItems.value = buildBlankCtxItems();
  openCtx(e.clientX, e.clientY);
}

function onCtxPick(key) {
  const row = ctxRow.value;
  if (key === 'reload') {
    loadFiles();
    return;
  }
  if (key === 'pasteT') {
    pasteIntoDirectory(uploadSubfolder.value.trim());
    return;
  }
  if (key === 'pasteR') {
    pasteIntoDirectory('');
    return;
  }
  if (!row) return;
  if (key === 'preview') openPreview(row);
  else if (key === 'download') downloadFile(row);
  else if (key === 'copyI') doCopyInternal(row);
  else if (key === 'cutI') doCutInternal(row);
  else if (key === 'pasteP') pasteIntoDirectory(parentDir(row.path));
  else if (key === 'copyPath') copyPath(row);
  else if (key === 'copyName') copyFileName(row);
  else if (key === 'setDir') {
    uploadSubfolder.value = parentDir(row.path);
    ElMessage.success(uploadSubfolder.value ? `已设为：${uploadSubfolder.value}` : '已设为根目录');
  } else if (key === 'props') openProps(row);
  else if (key === 'delete') removeFile(row);
}
function onMobileCardTap(row) {
  if (previewKindFor(row) !== 'none') {
    openPreview(row);
  }
}

function onMobileCommand(cmd, row) {
  if (cmd === 'preview') openPreview(row);
  else if (cmd === 'download') downloadFile(row);
  else if (cmd === 'copy') copyPath(row);
  else if (cmd === 'copyName') copyFileName(row);
  else if (cmd === 'copyInternal') doCopyInternal(row);
  else if (cmd === 'cutInternal') doCutInternal(row);
  else if (cmd === 'pasteParent') pasteIntoDirectory(parentDir(row.path));
  else if (cmd === 'pasteRoot') pasteIntoDirectory('');
  else if (cmd === 'props') openProps(row);
  else if (cmd === 'setTarget') {
    uploadSubfolder.value = parentDir(row.path);
    ElMessage.success(uploadSubfolder.value ? `已设为：${uploadSubfolder.value}` : '已设为根目录');
  } else if (cmd === 'delete') removeFile(row);
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
    if (preview.visible && preview.row?.path === row.path) {
      preview.visible = false;
    }
    await loadFiles();
  } catch {
    /* 拦截器 */
  }
}

async function handleUpload(option) {
  const { file, onError, onSuccess } = option;
  const fd = new FormData();
  fd.append('file', file);
  const sub = uploadSubfolder.value.trim();
  if (sub) {
    fd.append('path', sub);
  }
  const ctrl = createTransferTask({ type: 'upload', name: file.name || '未命名' });
  try {
    await http.post('/api/upload', fd, {
      timeout: 300000,
      onUploadProgress(ev) {
        const total = ev.total != null && ev.total > 0 ? ev.total : null;
        ctrl.updateProgress(ev.loaded, total);
      },
    });
    ctrl.success();
    ElMessage.success(`上传成功：${file.name}`);
    onSuccess?.();
    await loadFiles();
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || '上传失败';
    ctrl.fail(typeof msg === 'string' ? msg : '上传失败');
    onError?.(e);
  }
}
</script>

<style scoped>
.page {
  min-height: 100%;
  flex-direction: column;
  background: linear-gradient(180deg, var(--el-fill-color-blank) 0%, var(--app-bg, #f3f5f9) 120px);
}

.page--mobile .main {
  padding-bottom: 24px;
}

.header {
  padding: 20px 16px 12px;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  margin-bottom: 8px;
}

.title {
  margin: 0 0 8px;
  font-size: 26px;
  line-height: 1.15;
  letter-spacing: -0.02em;
  background: linear-gradient(120deg, var(--el-color-primary), #7c5cff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

html.dark .title {
  background: none;
  -webkit-background-clip: unset;
  background-clip: unset;
  color: var(--el-text-color-primary);
}

.subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.subtitle__repo {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.subtitle__div {
  margin: 0 4px;
}

.subtitle__tag {
  margin-left: 4px;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.upload-inline :deep(.el-upload) {
  display: inline-block;
}

.alert-block {
  margin-bottom: 12px;
  border-radius: 10px;
}

.toolbar {
  margin-top: 4px;
  padding: 12px;
  border-radius: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}

.toolbar--sticky {
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(8px);
}

.toolbar__row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.toolbar__row--secondary {
  margin-top: 10px;
}

.toolbar__search {
  flex: 1 1 200px;
  min-width: 0;
}

.toolbar__sort {
  width: 150px;
}

.toolbar__subfolder {
  flex: 1 1 220px;
  min-width: 0;
}

.toolbar__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.main {
  padding: 8px 16px 24px;
  flex: 1;
}

.card {
  border-radius: 14px;
  overflow: hidden;
}

.card--muted {
  opacity: 0.95;
}

.card--upload {
  margin-top: 12px;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.data-table {
  min-width: 560px;
}

.file-name {
  font-weight: 500;
  margin-right: 8px;
}

.ext-tag {
  vertical-align: middle;
}

.type-icon {
  vertical-align: middle;
}

.type-icon--image {
  color: #67c23a;
}

.type-icon--pdf {
  color: #f56c6c;
}

.type-icon--text {
  color: #409eff;
}

.type-icon--video {
  color: #e6a23c;
}

.type-icon--audio {
  color: #909399;
}

.type-icon--file {
  color: var(--el-text-color-secondary);
}

.mobile-list {
  min-height: 120px;
}

.m-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  margin-bottom: 10px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-overlay);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: default;
  -webkit-tap-highlight-color: transparent;
}

.m-card--tap {
  cursor: pointer;
}

.m-card--tap:active {
  transform: scale(0.99);
}

.m-card__icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.m-card__body {
  flex: 1;
  min-width: 0;
}

.m-card__title {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.3;
  word-break: break-all;
}

.m-card__path {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.m-card__meta {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.m-card__ops {
  flex-shrink: 0;
}

.m-card__more {
  min-height: 40px;
  padding: 0 14px;
}

.list-fade-enter-active,
.list-fade-leave-active {
  transition: opacity 0.2s ease;
}

.list-fade-enter-from,
.list-fade-leave-to {
  opacity: 0;
}

.drag-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}

.upload-drag :deep(.el-upload-dragger) {
  padding: 24px 16px;
}

.upload-drag__icon {
  font-size: 40px;
  color: var(--el-color-primary);
  margin-bottom: 8px;
}

.upload-drag__text {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.hint {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preview-box {
  min-height: 200px;
  height: calc(100dvh - 180px);
  max-height: calc(100vh - 180px);
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
  border-radius: 8px;
}

.preview-text {
  margin: 0;
  padding: 12px;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.site-footer {
  padding: 8px 16px max(16px, env(safe-area-inset-bottom));
  text-align: center;
}

.site-footer__mark {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.clip-tag {
  max-width: min(280px, 40vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.props-dl {
  margin: 0;
}

.props-row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}

.props-row:last-child {
  border-bottom: 0;
}

.props-row dt {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.props-row dd {
  margin: 0;
  word-break: break-word;
}

.props-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
}

.props-break {
  word-break: break-all;
}

@media (max-width: 767px) {
  .title {
    font-size: 20px;
  }

  .hero__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
