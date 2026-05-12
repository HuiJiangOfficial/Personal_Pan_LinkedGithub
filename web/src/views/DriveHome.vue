<template>
  <el-container class="page" :class="{ 'page--mobile': isMobile, 'page--has-bg': bgState.hasImage }" :style="pageShellStyle">
    <template v-if="bgState.hasImage">
      <div class="page__bg" aria-hidden="true" />
      <div class="page__bg-scrim" aria-hidden="true" />
    </template>
    <el-header class="header" height="auto">
      <div class="header__shell glass-panel">
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
            <el-tooltip content="外观与背景（仅本人可见）" placement="bottom">
              <el-button :icon="Brush" circle plain @click="openAppearance" />
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

      <div v-if="status.configured" class="toolbar toolbar--below" :class="{ 'toolbar--sticky': isMobile }">
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
          <el-dropdown v-if="isMobile && canMutateDrive" trigger="click" @command="onMobileLocationCommand">
            <el-button plain type="primary" size="small">
              位置与新建
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="newDir">新建目录…</el-dropdown-item>
                <el-dropdown-item command="newFile">新建文件…</el-dropdown-item>
                <el-dropdown-item divided command="propsCurDir">当前位置属性</el-dropdown-item>
                <el-dropdown-item command="propsParentDir" :disabled="!uploadSubfolder.trim()">父级目录属性</el-dropdown-item>
                <el-dropdown-item command="clearSubdir" :disabled="!uploadSubfolder.trim()" divided>清空上传子目录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
      </div>
    </el-header>

    <el-main class="main">
      <el-card v-if="status.configured" class="card glass-card" shadow="hover">
        <!-- 桌面：表格 -->
        <div v-if="!isMobile" class="table-wrap table-wrap--ctx" @contextmenu="onTableSurfaceContextmenu">
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

    <el-dialog v-model="newDirOpen" title="新建目录" width="min(420px, 92vw)" destroy-on-close class="props-dialog" @closed="newDirName = ''">
      <p class="dialog-hint">将在<strong>当前上传子目录</strong>下创建占位文件 <code>.gitkeep</code>（Git 无空目录概念）。名称不能含 <code>/</code>、<code>..</code>。</p>
      <el-input v-model="newDirName" maxlength="128" show-word-limit placeholder="目录名，如 notes、images" clearable @keyup.enter="submitNewDir" />
      <template #footer>
        <el-button @click="newDirOpen = false">取消</el-button>
        <el-button type="primary" :loading="newDirBusy" :disabled="!canMutateDrive" @click="submitNewDir">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="newFileOpen" title="新建文件" width="min(480px, 94vw)" destroy-on-close class="props-dialog" @closed="resetNewFileForm">
      <p class="dialog-hint">在<strong>当前上传子目录</strong>下创建 UTF-8 文本文件；重名将自动加后缀。</p>
      <el-form label-position="top" class="new-file-form">
        <el-form-item label="类型">
          <el-select v-model="newFileKind" class="w100" @change="onNewFileKindChange">
            <el-option v-for="opt in newFileKindOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="文件名（不含路径，可改扩展名）">
          <el-input v-model="newFileName" maxlength="160" show-word-limit placeholder="如 笔记.txt" clearable @keyup.enter="submitNewFile" />
        </el-form-item>
        <el-form-item label="初始内容（可改）">
          <el-input v-model="newFileBody" type="textarea" :rows="10" class="new-file-ta" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newFileOpen = false">取消</el-button>
        <el-button type="primary" :loading="newFileBusy" :disabled="!canMutateDrive" @click="submitNewFile">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="folderPropsOpen" :title="folderProps.title" width="min(440px, 92vw)" destroy-on-close class="props-dialog">
      <p class="dialog-hint folder-props-note">{{ folderProps.note }}</p>
      <dl class="props-dl">
        <div class="props-row">
          <dt>路径</dt>
          <dd class="props-mono">{{ folderProps.pathLabel }}</dd>
        </div>
        <div class="props-row">
          <dt>直接子文件</dt>
          <dd>{{ folderProps.directFiles }} 个</dd>
        </div>
        <div class="props-row">
          <dt>子树内文件</dt>
          <dd>{{ folderProps.subtreeFiles }} 个</dd>
        </div>
        <div class="props-row">
          <dt>子树合计大小</dt>
          <dd>{{ formatSize(folderProps.subtreeBytes) }}</dd>
        </div>
      </dl>
      <template #footer>
        <el-button type="primary" @click="folderPropsOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="appearanceOpen" direction="rtl" size="min(440px, 94vw)" destroy-on-close class="appearance-drawer">
      <template #header>
        <div class="appearance-drawer__head">
          <div class="appearance-drawer__title">外观与背景</div>
          <div class="appearance-drawer__sub">仅保存在您本人网盘内的隐藏目录，其他用户无法查看或访问</div>
        </div>
      </template>
      <p class="appearance-intro">
        背景图（JPG / PNG / GIF）与显示参数写入仓库中 <code>drive/{{ me.driveSub || '…' }}/.webpan/background/</code>，不会在文件列表中出现；拉取图片始终走鉴权接口，与通用文件下载隔离。
      </p>
      <el-alert v-if="!canMutateDrive" type="info" show-icon :closable="false" title="当前为只读账号" class="appearance-alert" />
      <div v-if="bgState.hasImage" class="appearance-preview-wrap">
        <span class="appearance-label">当前预览</span>
        <p class="appearance-preview-hint">展示原图（含 GIF 动效），与下方「蒙层 / 模糊」仅作用于主界面无关。</p>
        <div class="appearance-preview--native">
          <img
            class="appearance-preview__img"
            :src="appearancePreviewSrc"
            alt="背景图原图预览"
            loading="lazy"
            decoding="async"
            @load="onAppearancePreviewImgLoad"
            @error="onAppearancePreviewImgError"
          />
        </div>
      </div>
      <el-form label-position="top" class="appearance-form">
        <el-form-item label="上传背景图（JPG / PNG / GIF，最大 4MB）">
          <el-upload
            drag
            :disabled="!canMutateDrive"
            :show-file-list="false"
            accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
            :http-request="uploadDriveBackground"
          >
            <el-icon class="appearance-upload-icon"><UploadFilled /></el-icon>
            <div class="appearance-upload-text">拖拽或点击上传</div>
          </el-upload>
        </el-form-item>
        <el-form-item label="主界面蒙层（越高越偏实色，背景越淡；调低则更清晰）">
          <el-slider v-model="uiOverlay" :min="0.08" :max="0.78" :step="0.01" show-input :show-input-controls="false" />
        </el-form-item>
        <el-form-item label="主界面背景模糊（像素，0 最清晰，上限 20）">
          <el-slider v-model="uiBlur" :min="0" :max="20" :step="1" show-input />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="appearanceSaving" :disabled="!canMutateDrive" @click="saveAppearanceSettings">保存显示设置</el-button>
          <el-button type="danger" plain :loading="appearanceSaving" :disabled="!canMutateDrive || !bgState.hasImage" @click="clearDriveBackground">
            清除背景图
          </el-button>
        </el-form-item>
      </el-form>
    </el-drawer>
  </el-container>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { presentApiError, presentByCode, presentClientWarning } from '@/errors/presentError.js';
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
  FolderAdd,
  EditPen,
  ArrowUp,
  Close,
  Brush,
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

/** 与 functions/_userBackground.js USER_BG_MAX_BYTES 一致 */
const DRIVE_BG_MAX_BYTES = 4 * 1024 * 1024;

const router = useRouter();
const DARK_KEY = 'github_web_pan_dark';

const loading = ref(false);
const isMobile = ref(false);
const isDark = ref(false);
const keyword = ref('');
const sortKey = ref('name-asc');
const uploadSubfolder = ref('');

const appearanceOpen = ref(false);
const appearanceSaving = ref(false);
const bgVersion = ref('');
const bgState = reactive({
  hasImage: false,
  overlayOpacity: 0.32,
  blurPx: 2,
  updatedAt: /** @type {string | null} */ (null),
});
const uiOverlay = ref(0.32);
const uiBlur = ref(2);
/** 原图预览加载失败时提示一次 */
const appearancePreviewImgFailed = ref(false);

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

const newDirOpen = ref(false);
const newDirName = ref('');
const newDirBusy = ref(false);

const newFileOpen = ref(false);
const newFileKind = ref('txt');
const newFileName = ref('未命名.txt');
const newFileBody = ref('');
const newFileBusy = ref(false);

const folderPropsOpen = ref(false);
const folderProps = reactive({
  title: '',
  pathLabel: '',
  note: '',
  directFiles: 0,
  subtreeFiles: 0,
  subtreeBytes: 0,
});

const status = reactive({
  configured: true,
  branch: publicConfig.branch,
  truncated: false,
  varsPresent: {},
});

const me = reactive({
  user: '',
  role: /** @type {''|'admin'|'user'|'guest'} */ (''),
  /** 仓库内网盘根目录名，与 JWT 登录名可能不同（管理员固定为 __webpan_admin__） */
  driveSub: '',
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

const pageShellStyle = computed(() => {
  if (!bgState.hasImage) {
    return {
      '--drive-bg-image': 'none',
      '--drive-bg-blur': '0px',
      '--drive-scrim-opacity': '0',
    };
  }
  const v = encodeURIComponent(bgVersion.value || '0');
  return {
    '--drive-bg-image': `url("/api/drive-background?image=1&v=${v}")`,
    '--drive-bg-blur': `${bgState.blurPx}px`,
    '--drive-scrim-opacity': String(bgState.overlayOpacity),
  };
});

/** 管理页「当前预览」用 img 拉原图（与主界面 CSS 模糊/蒙层分离） */
const appearancePreviewSrc = computed(() => {
  if (!bgState.hasImage) return '';
  const v = encodeURIComponent(bgVersion.value || '0');
  return `/api/drive-background?image=1&v=${v}`;
});

function onAppearancePreviewImgError() {
  if (appearancePreviewImgFailed.value) return;
  appearancePreviewImgFailed.value = true;
  presentClientWarning(
    'BG_PREVIEW_LOAD_FAILED',
    '背景原图预览失败',
    '无法加载背景图，请刷新页面或重新上传。',
    '请确认已登录且网络正常；若刚更换背景，可关闭抽屉后重新打开外观设置。'
  );
}

function onAppearancePreviewImgLoad() {
  appearancePreviewImgFailed.value = false;
}

watch(appearancePreviewSrc, () => {
  appearancePreviewImgFailed.value = false;
});

const roleLabel = computed(() => {
  const root = me.driveSub ? ` · 仓库目录 drive/${me.driveSub}/` : '';
  if (me.role === 'admin') return `管理员${root}`;
  if (me.role === 'user') return `用户 · ${me.user}${root}`;
  if (me.role === 'guest') return `访客（只读·白名单）${root}`;
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
    const { data } = await http.get('/api/status', { skipGlobalErrorHandler: true });
    status.configured = Boolean(data.configured);
    status.branch = data.branch || status.branch;
    if (data.varsPresent && typeof data.varsPresent === 'object') {
      status.varsPresent = { ...data.varsPresent };
    }

    if (data.code === 'SRV_NOT_CONFIGURED' || data.code === 'SRV_JWT_NOT_SET') {
      await presentByCode(data.code);
      status.configured = false;
      return;
    }

    if (!status.configured) {
      return;
    }

    const meRes = await http.get('/api/auth/me', { skipGlobalErrorHandler: true });
    if (meRes.data?.authenticated) {
      me.user = meRes.data.user || '';
      me.role = meRes.data.role || '';
      me.driveSub = meRes.data.driveSub || '';
    }

    await loadFiles();
    await loadDriveBackground();
  } catch (e) {
    await presentApiError(e, { context: 'bootstrap' });
  }
}

async function logout() {
  try {
    await http.post('/api/auth/logout', undefined, { skipGlobalErrorHandler: true });
  } catch {
    /* ignore */
  }
  me.user = '';
  me.role = '';
  me.driveSub = '';
  bgState.hasImage = false;
  bgState.overlayOpacity = 0.32;
  bgState.blurPx = 2;
  bgState.updatedAt = null;
  bgVersion.value = '';
  await router.push('/login');
}

function goAdmin() {
  router.push('/admin');
}

async function loadDriveBackground() {
  if (!status.configured) return;
  try {
    const { data } = await http.get('/api/drive-background', { skipGlobalErrorHandler: true });
    if (!data?.ok) return;
    bgState.hasImage = Boolean(data.hasImage);
    const s = data.settings || {};
    bgState.overlayOpacity = typeof s.overlayOpacity === 'number' ? s.overlayOpacity : 0.32;
    bgState.blurPx = typeof s.blurPx === 'number' ? s.blurPx : 2;
    bgState.updatedAt = s.updatedAt || null;
    bgVersion.value = bgState.updatedAt || String(Date.now());
  } catch {
    /* 未登录或网络错误时忽略 */
  }
}

function openAppearance() {
  uiOverlay.value = bgState.overlayOpacity;
  uiBlur.value = bgState.blurPx;
  appearanceOpen.value = true;
}

async function saveAppearanceSettings() {
  if (!canMutateDrive.value) return;
  appearanceSaving.value = true;
  try {
    const fd = new FormData();
    fd.append('overlayOpacity', String(uiOverlay.value));
    fd.append('blurPx', String(uiBlur.value));
    await http.post('/api/drive-background', fd, { skipGlobalErrorHandler: true });
    ElMessage.success('显示设置已保存');
    await loadDriveBackground();
  } catch (e) {
    void presentApiError(e);
  } finally {
    appearanceSaving.value = false;
  }
}

async function uploadDriveBackground(opt) {
  if (!canMutateDrive.value) return;
  const { file, onError, onSuccess } = opt;
  const uploadFile = file?.raw ?? file;
  if (typeof uploadFile?.size === 'number' && uploadFile.size > DRIVE_BG_MAX_BYTES) {
    presentClientWarning(
      'CLIENT_BG_TOO_LARGE',
      '背景图过大',
      `背景图须小于 ${Math.floor(DRIVE_BG_MAX_BYTES / 1024 / 1024)} MB。`,
      '请压缩图片或换用较小文件后再试。'
    );
    onError?.(new Error('文件过大'));
    return;
  }
  appearanceSaving.value = true;
  try {
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('overlayOpacity', String(uiOverlay.value));
    fd.append('blurPx', String(uiBlur.value));
    await http.post('/api/drive-background', fd, { timeout: 120000, skipGlobalErrorHandler: true });
    ElMessage.success('背景图已更新');
    await loadDriveBackground();
    onSuccess?.();
  } catch (e) {
    void presentApiError(e);
    onError?.(e);
  } finally {
    appearanceSaving.value = false;
  }
}

async function clearDriveBackground() {
  if (!canMutateDrive.value || !bgState.hasImage) return;
  try {
    await ElMessageBox.confirm(
      '将删除您网盘中的背景图文件，显示参数将恢复为默认。此操作会写入 GitHub 提交记录。',
      '清除背景',
      { type: 'warning' }
    );
  } catch {
    return;
  }
  appearanceSaving.value = true;
  try {
    await http.delete('/api/drive-background', { skipGlobalErrorHandler: true });
    ElMessage.success('已清除背景');
    await loadDriveBackground();
    uiOverlay.value = bgState.overlayOpacity;
    uiBlur.value = bgState.blurPx;
  } catch (e) {
    void presentApiError(e);
  } finally {
    appearanceSaving.value = false;
  }
}

async function loadFiles() {
  if (!status.configured) return;
  loading.value = true;
  try {
    const { data } = await http.get('/api/list', { skipGlobalErrorHandler: true });
    files.value = Array.isArray(data.files) ? data.files : [];
    if (data.driveSub) me.driveSub = data.driveSub;
    status.truncated = Boolean(data.truncated);
    if (data.branch) status.branch = data.branch;
  } catch (e) {
    if (e?.response?.status === 401) {
      await router.replace('/login');
    } else {
      void presentApiError(e);
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
      skipGlobalErrorHandler: true,
    });

    if (kind === 'text') {
      preview.text = typeof res.data === 'string' ? res.data : String(res.data);
      return;
    }

    preview.url = URL.createObjectURL(res.data);
  } catch (e) {
    revokePreviewUrl();
    preview.kind = 'none';
    void presentApiError(e, { severityOverride: 'warning' });
  }
}

async function downloadFile(row) {
  const ctrl = createTransferTask({ type: 'download', name: row.name || row.path });
  try {
    const res = await http.get('/api/raw', {
      params: { path: row.path, download: 1 },
      responseType: 'blob',
      skipGlobalErrorHandler: true,
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
    void presentApiError(e, { severityOverride: 'warning' });
  }
}

async function copyPath(row) {
  const p = row.path;
  try {
    await navigator.clipboard.writeText(p);
    ElMessage.success('已复制路径');
  } catch (e) {
    console.warn('[WebPan]', 'CLIPBOARD_PATH_FAIL', e);
    void ElMessageBox.alert(
      `${p}\n\n【说明】浏览器未允许写入剪贴板。请在浏览器设置中允许本站访问剪贴板，或使用 HTTPS 访问后重试；也可手动选中上方路径复制。`,
      '路径（请手动复制）',
      { confirmButtonText: '关闭' }
    );
  }
}

async function copyFileName(row) {
  const n = row.name || '';
  try {
    await navigator.clipboard.writeText(n);
    ElMessage.success('已复制文件名');
  } catch (e) {
    console.warn('[WebPan]', 'CLIPBOARD_NAME_FAIL', e);
    void ElMessageBox.alert(
      `${n}\n\n【说明】浏览器未允许写入剪贴板，请手动选中复制。`,
      '文件名（请手动复制）',
      { confirmButtonText: '关闭' }
    );
  }
}

function parentDir(relPath) {
  const s = String(relPath || '');
  const i = s.lastIndexOf('/');
  return i < 0 ? '' : s.slice(0, i);
}

const NEW_FILE_KINDS = {
  txt: { label: '纯文本 (.txt)', ext: 'txt', mime: 'text/plain;charset=utf-8', tpl: '' },
  md: { label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown;charset=utf-8', tpl: '# 新文档\n\n' },
  json: { label: 'JSON (.json)', ext: 'json', mime: 'application/json;charset=utf-8', tpl: '{\n  \n}\n' },
  html: {
    label: 'HTML (.html)',
    ext: 'html',
    mime: 'text/html;charset=utf-8',
    tpl: '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8" />\n  <title>新建</title>\n</head>\n<body>\n\n</body>\n</html>\n',
  },
  css: { label: 'CSS (.css)', ext: 'css', mime: 'text/css;charset=utf-8', tpl: '/* 样式 */\n' },
  js: { label: 'JavaScript (.js)', ext: 'js', mime: 'text/javascript;charset=utf-8', tpl: '//\n' },
  yml: { label: 'YAML (.yml)', ext: 'yml', mime: 'text/yaml;charset=utf-8', tpl: '#\n' },
  log: { label: '日志 (.log)', ext: 'log', mime: 'text/plain;charset=utf-8', tpl: '' },
};

const newFileKindOptions = Object.entries(NEW_FILE_KINDS).map(([value, v]) => ({ value, label: v.label }));

function isBlockedRelPath(rel) {
  const p = String(rel || '').replace(/^\/+/, '').trim();
  return p === '.webpan' || p.startsWith('.webpan/') || p.includes('/.webpan/');
}

function sanitizeFolderName(raw) {
  const s = String(raw || '').trim();
  if (!s || s.includes('..') || /[\\/]/.test(s)) return '';
  if (/[\x00-\x1f]/.test(s)) return '';
  if (s.length > 128) return '';
  const low = s.toLowerCase();
  if (low === '.webpan' || low.startsWith('.webpan')) return '';
  return s;
}

/** 仅文件名段，可含扩展名 */
function sanitizeFileNameInput(raw) {
  let s = String(raw || '').trim().replace(/\\/g, '/');
  const seg = s.split('/').filter(Boolean);
  s = seg.length ? seg[seg.length - 1] : '';
  if (!s || s.includes('..') || s.includes('/') || /[\x00-\x1f]/.test(s)) return '';
  if (s.length > 160) return '';
  const low = s.toLowerCase();
  if (low === '.webpan' || low.startsWith('.webpan')) return '';
  return s;
}

function filesUnderPrefix(prefix) {
  const p = String(prefix || '').trim();
  if (!p) return files.value;
  return files.value.filter((f) => f.path === p || f.path.startsWith(`${p}/`));
}

function directFilesUnderPrefix(prefix) {
  const p = String(prefix || '').trim();
  return files.value.filter((f) => parentDir(f.path) === p);
}

function computeFolderStats(prefix) {
  const list = filesUnderPrefix(prefix);
  const bytes = list.reduce((s, f) => s + (Number(f.size) || 0), 0);
  return {
    subtreeFiles: list.length,
    subtreeBytes: bytes,
    directFiles: directFilesUnderPrefix(prefix).length,
  };
}

function resetNewFileForm() {
  newFileKind.value = 'txt';
  newFileName.value = '未命名.txt';
  newFileBody.value = NEW_FILE_KINDS.txt.tpl;
}

function onNewFileKindChange(nextKind) {
  const k = NEW_FILE_KINDS[nextKind];
  if (!k) return;
  let name = newFileName.value.trim();
  if (!name) {
    newFileName.value = `未命名.${k.ext}`;
  } else {
    const i = name.lastIndexOf('.');
    const stem = i > 0 ? name.slice(0, i) : name;
    newFileName.value = `${stem}.${k.ext}`;
  }
  newFileBody.value = k.tpl;
}

function fillFolderProps(prefix, title) {
  const st = computeFolderStats(prefix);
  folderProps.title = title;
  folderProps.pathLabel = prefix || '(根目录)';
  folderProps.directFiles = st.directFiles;
  folderProps.subtreeFiles = st.subtreeFiles;
  folderProps.subtreeBytes = st.subtreeBytes;
  folderProps.note =
    '统计基于 Git 树中的文件列表：空目录若无占位文件则不会出现在树中；若树被截断，数字可能不完整。';
}

function openFolderPropsDialog(which) {
  const cur = uploadSubfolder.value.trim();
  const prefix = which === 'parent' ? parentDir(cur) : cur;
  if (which === 'parent' && !cur) return;
  fillFolderProps(prefix, which === 'parent' ? '父级目录属性' : '当前位置属性');
  folderPropsOpen.value = true;
}

function openFolderPropsForPath(prefix) {
  fillFolderProps(prefix, '目录属性');
  folderPropsOpen.value = true;
}

function onMobileLocationCommand(cmd) {
  if (cmd === 'newDir') {
    newDirName.value = '';
    newDirOpen.value = true;
  } else if (cmd === 'newFile') {
    resetNewFileForm();
    newFileOpen.value = true;
  } else if (cmd === 'propsCurDir') openFolderPropsDialog('current');
  else if (cmd === 'propsParentDir') openFolderPropsDialog('parent');
  else if (cmd === 'clearSubdir') {
    uploadSubfolder.value = '';
    ElMessage.success('已清空上传子目录');
  }
}

async function uploadTextToDrive(fullRelPath, textContent, mime) {
  const norm = String(fullRelPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm || isBlockedRelPath(norm)) throw new Error('非法或受保护路径');
  const parts = norm.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error('缺少文件名');
  const dir = parts.join('/');
  const blob = new Blob([textContent], { type: mime || 'text/plain;charset=utf-8' });
  const file = new File([blob], fileName, { type: blob.type });
  const fd = new FormData();
  fd.append('file', file);
  if (dir) fd.append('path', `${dir}/`);
  const ctrl = createTransferTask({ type: 'upload', name: fileName });
  try {
    await http.post('/api/upload', fd, {
      timeout: 300000,
      skipGlobalErrorHandler: true,
      onUploadProgress(ev) {
        const total = ev.total != null && ev.total > 0 ? ev.total : null;
        ctrl.updateProgress(ev.loaded, total);
      },
    });
    if (blob.size > 0) ctrl.updateProgress(blob.size, blob.size);
    ctrl.success();
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || '上传失败';
    ctrl.fail(typeof msg === 'string' ? msg : '上传失败');
    void presentApiError(e, { severityOverride: 'warning' });
    throw e;
  }
}

/** 若路径已存在则加 (2) 后缀 */
function uniqueFileRelPath(targetDir, fileName) {
  const reserved = new Set(files.value.map((f) => f.path));
  const join = (dir, name) => (dir ? `${dir}/${name}` : name);
  let stem = fileName;
  let ext = '';
  const dot = fileName.lastIndexOf('.');
  if (dot > 0 && dot < fileName.length - 1) {
    stem = fileName.slice(0, dot);
    ext = fileName.slice(dot);
  }
  let n = 0;
  for (;;) {
    const name = n === 0 ? fileName : `${stem} (${n})${ext}`;
    const rel = join(targetDir, name);
    if (!reserved.has(rel)) return rel;
    n += 1;
    if (n > 500) throw new Error('无法生成不冲突的文件名');
  }
}

async function submitNewDir() {
  if (!canMutateDrive.value) return;
  const name = sanitizeFolderName(newDirName.value);
  if (!name) {
    ElMessage.warning('请输入有效的目录名（不能含 /、\\、.. 等）');
    return;
  }
  const base = uploadSubfolder.value.trim();
  const rel = base ? `${base}/${name}/.gitkeep` : `${name}/.gitkeep`;
  if (isBlockedRelPath(rel)) {
    ElMessage.error('不能在该路径下创建');
    return;
  }
  if (files.value.some((f) => f.path === rel)) {
    ElMessage.error('该占位文件已存在，请换名或删除后重试');
    return;
  }
  const prefix = base ? `${base}/${name}` : name;
  if (files.value.some((f) => f.path !== rel && (f.path === prefix || f.path.startsWith(`${prefix}/`)))) {
    ElMessage.warning('该目录下已有其它文件，仍可使用；若仅需占位请确认名称不冲突');
  }
  newDirBusy.value = true;
  try {
    const content = '# WebPan 目录占位（可删除；目录内仍有其它文件时删除不影响目录）\n';
    await uploadTextToDrive(rel, content, 'text/plain;charset=utf-8');
    ElMessage.success(`已创建目录占位：${prefix}`);
    newDirOpen.value = false;
    newDirName.value = '';
    await loadFiles();
  } catch {
    /* 已提示 */
  } finally {
    newDirBusy.value = false;
  }
}

async function submitNewFile() {
  if (!canMutateDrive.value) return;
  const kind = NEW_FILE_KINDS[newFileKind.value];
  if (!kind) return;
  let fname = sanitizeFileNameInput(newFileName.value);
  if (!fname) {
    ElMessage.warning('请输入有效文件名');
    return;
  }
  if (!fname.includes('.')) fname = `${fname}.${kind.ext}`;
  else {
    const ext = fname.slice(fname.lastIndexOf('.') + 1).toLowerCase();
    if (ext !== kind.ext) {
      const stem = fname.slice(0, fname.lastIndexOf('.'));
      fname = `${stem}.${kind.ext}`;
      ElMessage.info(`已按所选类型将扩展名设为 .${kind.ext}`);
    }
  }
  const base = uploadSubfolder.value.trim();
  const rel = uniqueFileRelPath(base, fname);
  if (isBlockedRelPath(rel)) {
    ElMessage.error('不能在该路径下创建');
    return;
  }
  newFileBusy.value = true;
  try {
    await uploadTextToDrive(rel, newFileBody.value, kind.mime);
    ElMessage.success(`已创建：${rel}`);
    newFileOpen.value = false;
    resetNewFileForm();
    await loadFiles();
  } catch {
    /* */
  } finally {
    newFileBusy.value = false;
  }
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
        const res = await http.get('/api/raw', {
          params: { path: item.path },
          responseType: 'blob',
          skipGlobalErrorHandler: true,
        });
        const blob = res.data;
        const file = new File([blob], destName, { type: blob.type || 'application/octet-stream' });
        const fd = new FormData();
        fd.append('file', file);
        if (dir) fd.append('path', `${dir}/`);
        await http.post('/api/upload', fd, {
          timeout: 300000,
          skipGlobalErrorHandler: true,
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
        await http.delete('/api/file', { params: { path: item.path }, skipGlobalErrorHandler: true });
      }
    }
    clearDriveClipboard();
    ElMessage.success('粘贴完成');
    await loadFiles();
  } catch (e) {
    void presentApiError(e, { severityOverride: 'warning' });
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
    { type: 'label', label: '打开' },
    { key: 'preview', label: '预览', icon: View, show: canPrev },
    { key: 'download', label: '下载', icon: Download },
    { type: 'divider' },
    { type: 'label', label: '剪贴板' },
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
    { type: 'label', label: '路径与目录' },
    { key: 'copyPath', label: '复制路径', icon: DocumentCopy },
    { key: 'copyName', label: '复制文件名', icon: DocumentCopy },
    { key: 'setDir', label: '将上传子目录设为所在文件夹', icon: FolderOpened },
    { key: 'propsDirRow', label: '所在目录属性', icon: ArrowUp },
    { type: 'divider' },
    { type: 'label', label: '信息' },
    { key: 'props', label: '文件属性', icon: InfoFilled },
    { type: 'divider' },
    { type: 'label', label: '危险操作' },
    { key: 'delete', label: '删除', icon: Delete, danger: true, disabled: !canMutateDrive.value },
  ];
}

function buildBlankCtxItems() {
  const sub = uploadSubfolder.value.trim();
  const subLabel = sub ? `粘贴到「${sub}」` : '粘贴到当前子目录（根）';
  const canWrite = canMutateDrive.value;
  const hasSub = Boolean(sub);
  /** @type {any[]} */
  const out = [
    { type: 'label', label: '剪贴板' },
    {
      key: 'pasteT',
      label: subLabel,
      icon: DocumentAdd,
      disabled: !canWrite || !hasDriveClipboard.value,
    },
    {
      key: 'pasteR',
      label: '粘贴到网盘根目录',
      icon: FolderOpened,
      disabled: !canWrite || !hasDriveClipboard.value,
    },
  ];
  if (canWrite) {
    out.push(
      { type: 'divider' },
      { type: 'label', label: '新建' },
      { key: 'newDir', label: '新建目录…', icon: FolderAdd },
      { key: 'newFile', label: '新建文件…', icon: EditPen }
    );
  }
  out.push(
    { type: 'divider' },
    { type: 'label', label: '位置' },
    {
      key: 'propsCurDir',
      label: '当前位置属性',
      icon: FolderOpened,
    },
    {
      key: 'propsParentDir',
      label: '父级目录属性',
      icon: ArrowUp,
      disabled: !hasSub,
    },
    {
      key: 'clearSubdir',
      label: '清空上传子目录',
      icon: Close,
      disabled: !hasSub,
    },
    { type: 'divider' },
    { type: 'label', label: '列表' },
    { key: 'reload', label: '刷新', icon: RefreshRight }
  );
  return out;
}

function onRowContextMenu(row, _col, e) {
  e.preventDefault();
  e.stopPropagation();
  ctxRow.value = row;
  ctxItems.value = buildRowCtxItems(row);
  openCtx(e.clientX, e.clientY);
}

/** 是否为「真实数据行」右键（排除表头、空列表占位行） */
function isDataRowContextMenuTarget(e) {
  if (e.target.closest?.('.el-table__header-wrapper')) return false;
  const tr = e.target.closest?.('tbody tr.el-table__row');
  if (!tr) return false;
  if (tr.querySelector?.('.el-table__empty-block')) return false;
  return true;
}

function onTableSurfaceContextmenu(e) {
  e.preventDefault();
  if (isDataRowContextMenuTarget(e)) return;
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
  if (key === 'newDir') {
    newDirName.value = '';
    newDirOpen.value = true;
    return;
  }
  if (key === 'newFile') {
    resetNewFileForm();
    newFileOpen.value = true;
    return;
  }
  if (key === 'propsCurDir') {
    openFolderPropsDialog('current');
    return;
  }
  if (key === 'propsParentDir') {
    openFolderPropsDialog('parent');
    return;
  }
  if (key === 'clearSubdir') {
    uploadSubfolder.value = '';
    ElMessage.success('已清空上传子目录');
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
  } else if (key === 'propsDirRow') openFolderPropsForPath(parentDir(row.path));
  else if (key === 'props') openProps(row);
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
    await http.delete('/api/file', { params: { path: row.path }, skipGlobalErrorHandler: true });
    ElMessage.success('已删除');
    if (preview.visible && preview.row?.path === row.path) {
      preview.visible = false;
    }
    await loadFiles();
  } catch (e) {
    void presentApiError(e, { severityOverride: 'warning' });
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
      skipGlobalErrorHandler: true,
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
    void presentApiError(e, { severityOverride: 'warning' });
    onError?.(e);
  }
}
</script>

<style scoped>
.page {
  min-height: 100%;
  flex-direction: column;
  position: relative;
  background: linear-gradient(180deg, var(--el-fill-color-blank) 0%, var(--app-bg, #f3f5f9) 120px);
}

.page--has-bg {
  background: transparent;
}

/* 全屏背景层：由 --drive-bg-image / --drive-bg-blur / --drive-scrim-opacity 驱动（见 pageShellStyle） */
.page__bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: var(--drive-bg-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transform: scale(1.01);
  filter: blur(var(--drive-bg-blur, 0px));
  will-change: filter;
}

.page__bg-scrim {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: color-mix(in srgb, var(--el-bg-color) calc(var(--drive-scrim-opacity, 0) * 100%), transparent);
}

.header,
.main,
.site-footer {
  position: relative;
  z-index: 2;
}

.header__shell.glass-panel {
  border-radius: 22px;
  padding: 18px 20px 14px;
  background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 50%, transparent);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(10px) saturate(1.12);
  -webkit-backdrop-filter: blur(10px) saturate(1.12);
}

.page--has-bg .header__shell.glass-panel {
  background: color-mix(in srgb, var(--el-bg-color) 44%, transparent);
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.1);
}

html.dark .header__shell.glass-panel {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.glass-card {
  --el-card-bg-color: color-mix(in srgb, var(--el-bg-color) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-border-color-lighter) 80%, transparent);
  border-radius: 18px;
  backdrop-filter: blur(12px) saturate(1.08);
  -webkit-backdrop-filter: blur(12px) saturate(1.08);
}

.page--has-bg .glass-card {
  --el-card-bg-color: color-mix(in srgb, var(--el-bg-color) 40%, transparent);
}

.page--has-bg .toolbar {
  background: color-mix(in srgb, var(--el-bg-color) 42%, transparent);
  border-color: color-mix(in srgb, var(--el-border-color-lighter) 65%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.page--has-bg .m-card {
  background: color-mix(in srgb, var(--el-bg-color) 42%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.page--has-bg .card--upload {
  --el-card-bg-color: color-mix(in srgb, var(--el-bg-color) 44%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.appearance-drawer__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 28px;
}

.appearance-drawer__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.3;
}

.appearance-drawer__sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
}

.appearance-intro {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.appearance-intro code {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  word-break: break-all;
}

.appearance-alert {
  margin-bottom: 16px;
}

.appearance-preview-hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.appearance-preview-wrap {
  margin-bottom: 18px;
}

.appearance-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}

.appearance-preview--native {
  height: 148px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-border-color) 25%, transparent);
}

.appearance-preview__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.appearance-form :deep(.el-upload-dragger) {
  border-radius: 16px;
  padding: 28px 16px;
  background: var(--el-fill-color-blank);
  border-color: var(--el-border-color);
  transition: border-color 0.2s ease, background 0.2s ease;
}

.appearance-form :deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary-light-5);
}

.appearance-upload-icon {
  font-size: 36px;
  color: var(--el-color-primary);
  margin-bottom: 8px;
}

.appearance-upload-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
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
  border-radius: 14px;
}

.toolbar {
  margin-top: 4px;
  padding: 12px;
  border-radius: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}

.toolbar :deep(.el-input__wrapper),
.toolbar :deep(.el-select .el-input__wrapper) {
  border-radius: 12px;
}

.toolbar--sticky {
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(6px);
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
  border-radius: 18px;
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

.table-wrap--ctx {
  min-height: min(380px, 52vh);
}

.data-table {
  min-width: 560px;
}

.glass-card :deep(.el-card__body) {
  border-radius: 0 0 18px 18px;
}

.glass-card :deep(.el-table) {
  --el-table-border-color: color-mix(in srgb, var(--el-border-color-lighter) 85%, transparent);
}

.glass-card :deep(.el-table th.el-table__cell) {
  border-radius: 0;
}

.page--has-bg .glass-card :deep(.el-table tr) {
  background-color: color-mix(in srgb, var(--el-fill-color-blank) 38%, transparent);
}

.page--has-bg .glass-card :deep(.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell) {
  background-color: color-mix(in srgb, var(--el-fill-color-light) 32%, transparent);
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
  border-radius: 16px;
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
  border-radius: 14px;
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
  border-radius: 16px;
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
  border-radius: 14px;
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

.dialog-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}

.dialog-hint code {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
}

.folder-props-note {
  margin-bottom: 12px;
}

.new-file-form {
  margin-top: 4px;
}

.w100 {
  width: 100%;
}

.new-file-ta :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.45;
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
