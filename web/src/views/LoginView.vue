<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="hover">
      <template #header>
        <span class="auth-title">登录网盘</span>
      </template>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名（管理员账号见环境变量 ADMIN_USERNAME）">
          <el-input v-model="username" autocomplete="username" placeholder="用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="password" type="password" show-password autocomplete="current-password" placeholder="密码" />
        </el-form-item>
        <el-button type="primary" class="w100" :loading="loading" native-type="submit">登录</el-button>
      </el-form>
      <el-divider />
      <div class="auth-row">
        <router-link v-if="opts.allowRegistration" to="/register">注册新用户</router-link>
        <span v-else class="muted">管理员已关闭注册</span>
        <el-button v-if="opts.guestEnabled" link type="primary" @click="guestLogin">访客进入（只读）</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { http } from '@/api/http.js';
import { presentApiError } from '@/errors/presentError.js';

const route = useRoute();
const router = useRouter();
const username = ref('');
const password = ref('');
const loading = ref(false);
const opts = reactive({ guestEnabled: false, allowRegistration: true });

onMounted(async () => {
  try {
    const { data } = await http.get('/api/auth/options', { skipGlobalErrorHandler: true });
    opts.guestEnabled = Boolean(data.guestEnabled);
    opts.allowRegistration = data.allowRegistration !== false;
  } catch {
    /* ignore */
  }
});

async function submit() {
  if (!username.value.trim() || !password.value) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }
  loading.value = true;
  try {
    await http.post(
      '/api/auth/login',
      {
        username: username.value.trim(),
        password: password.value,
      },
      { skipGlobalErrorHandler: true }
    );
    ElMessage.success('登录成功');
    const red = typeof route.query.redirect === 'string' ? route.query.redirect : '/drive';
    await router.replace(red || '/drive');
  } catch (e) {
    void presentApiError(e, { severityOverride: e?.response?.status === 401 ? 'warning' : undefined });
  } finally {
    loading.value = false;
  }
}

async function guestLogin() {
  loading.value = true;
  try {
    await http.post('/api/auth/guest', undefined, { skipGlobalErrorHandler: true });
    ElMessage.success('已以访客身份进入');
    await router.replace('/drive');
  } catch (e) {
    void presentApiError(e, { severityOverride: 'warning' });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: var(--app-bg, #f3f5f9);
}
.auth-card {
  width: min(420px, 100%);
  border-radius: 14px;
}
.auth-title {
  font-weight: 700;
  font-size: 16px;
}
.w100 {
  width: 100%;
}
.auth-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
