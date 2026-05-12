<template>
  <div class="admin">
    <el-page-header @back="router.push('/drive')" content="管理后台" />
    <p class="hint">管理员密码与账号仅来自环境变量，无法在此查看明文。普通用户密码以 PBKDF2 哈希存入 GitHub，无法反查，仅可重置。</p>

    <el-tabs v-model="tab">
      <el-tab-pane label="访客与注册" name="s">
        <el-form label-width="140px" class="form-block">
          <el-form-item label="允许自助注册">
            <el-switch v-model="settings.allowRegistration" @change="saveSettings" />
          </el-form-item>
          <el-form-item label="启用访客">
            <el-switch v-model="settings.guestEnabled" @change="saveSettings" />
          </el-form-item>
          <el-form-item label="访客可见路径">
            <el-input
              v-model="guestPathsText"
              type="textarea"
              :rows="5"
              placeholder="每行一条，相对于访客网盘根目录的路径（仓库内为 drive/guest/…）。支持前缀如 public/ 或精确文件。留空则访客看不到任何文件。"
              @blur="saveGuestPaths"
            />
          </el-form-item>
          <el-form-item label="隐藏 .gitkeep">
            <el-switch v-model="settings.ignoreGitkeep" @change="saveSettings" />
            <span class="field-hint">开启后网盘列表不显示名为 <code>.gitkeep</code> 的文件（目录占位）；关闭后可在列表中查看、删除。</span>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="用户" name="u">
        <el-button type="primary" class="mb" @click="openAdd">添加用户</el-button>
        <el-table :data="users" stripe>
          <el-table-column prop="username" label="用户名" />
          <el-table-column prop="role" label="角色" width="100" />
          <el-table-column prop="createdAt" label="创建时间" min-width="160" />
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button link type="primary" @click="openReset(row)">重置密码</el-button>
              <el-button link type="danger" @click="removeUser(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dlgAdd" title="添加用户" width="min(92vw, 420px)">
      <el-input v-model="addName" placeholder="用户名" class="mb8" />
      <el-input v-model="addPwd" type="password" show-password placeholder="初始密码（≥6位）" />
      <template #footer>
        <el-button @click="dlgAdd = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doAdd">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dlgReset" title="重置密码" width="min(92vw, 420px)">
      <p>用户：<b>{{ resetRow?.username }}</b></p>
      <el-input v-model="resetPwd" type="password" show-password placeholder="新密码（≥6位）" />
      <template #footer>
        <el-button @click="dlgReset = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doReset">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { http } from '@/api/http.js';
import { presentApiError } from '@/errors/presentError.js';

const router = useRouter();
const tab = ref('s');
const users = ref([]);
const settings = reactive({ guestEnabled: false, allowRegistration: true, guestPaths: [], ignoreGitkeep: true });
const guestPathsText = ref('');
const saving = ref(false);
const dlgAdd = ref(false);
const addName = ref('');
const addPwd = ref('');
const dlgReset = ref(false);
const resetRow = ref(null);
const resetPwd = ref('');

onMounted(async () => {
  await loadAll();
});

async function loadAll() {
  try {
    const [u, s] = await Promise.all([
      http.get('/api/admin/users', { skipGlobalErrorHandler: true }),
      http.get('/api/admin/settings', { skipGlobalErrorHandler: true }),
    ]);
    users.value = u.data.users || [];
    settings.guestEnabled = Boolean(s.data.guestEnabled);
    settings.allowRegistration = s.data.allowRegistration !== false;
    settings.ignoreGitkeep = s.data.ignoreGitkeep !== false;
    settings.guestPaths = Array.isArray(s.data.guestPaths) ? s.data.guestPaths : [];
    guestPathsText.value = settings.guestPaths.join('\n');
  } catch (e) {
    void presentApiError(e, { severityOverride: 'critical' });
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await http.patch('/api/admin/settings', {
      guestEnabled: settings.guestEnabled,
      allowRegistration: settings.allowRegistration,
      ignoreGitkeep: settings.ignoreGitkeep,
    });
    ElMessage.success('已保存');
  } catch {
    /* */
  } finally {
    saving.value = false;
  }
}

async function saveGuestPaths() {
  const lines = guestPathsText.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  saving.value = true;
  try {
    await http.patch('/api/admin/settings', { guestPaths: lines });
    settings.guestPaths = lines;
    ElMessage.success('访客路径已更新');
  } catch {
    /* */
  } finally {
    saving.value = false;
  }
}

function openAdd() {
  addName.value = '';
  addPwd.value = '';
  dlgAdd.value = true;
}

async function doAdd() {
  saving.value = true;
  try {
    await http.post('/api/admin/users', { username: addName.value.trim(), password: addPwd.value });
    ElMessage.success('已添加');
    dlgAdd.value = false;
    await loadAll();
  } catch {
    /* */
  } finally {
    saving.value = false;
  }
}

function openReset(row) {
  resetRow.value = row;
  resetPwd.value = '';
  dlgReset.value = true;
}

async function doReset() {
  saving.value = true;
  try {
    await http.post('/api/admin/password', {
      username: resetRow.value.username,
      password: resetPwd.value,
    });
    ElMessage.success('密码已重置');
    dlgReset.value = false;
  } catch {
    /* */
  } finally {
    saving.value = false;
  }
}

async function removeUser(row) {
  try {
    await ElMessageBox.confirm(`确定删除用户「${row.username}」？`, '确认', { type: 'warning' });
  } catch {
    return;
  }
  try {
    const res = await http.delete('/api/admin/users', { params: { username: row.username } });
    const n = res.data?.deletedFiles ?? 0;
    ElMessage.success(`已删除用户，并移除仓库中 ${n} 个文件`);
    await loadAll();
  } catch {
    /* */
  }
}
</script>

<style scoped>
.admin {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 16px 48px;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 12px 0 20px;
}
.form-block {
  max-width: 640px;
}
.mb {
  margin-bottom: 12px;
}
.mb8 {
  margin-bottom: 8px;
}
.field-hint {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.field-hint code {
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--el-fill-color-light);
}
</style>
