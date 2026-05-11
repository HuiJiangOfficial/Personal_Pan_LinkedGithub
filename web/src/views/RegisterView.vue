<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="hover">
      <template #header>
        <span class="auth-title">注册</span>
      </template>
      <el-alert v-if="!opts.allowRegistration" type="warning" show-icon :closable="false" title="当前不允许自助注册" />
      <template v-else>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="用户名">
            <el-input v-model="username" autocomplete="username" placeholder="3–32 位字母数字，可含 _ -" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="password" type="password" show-password autocomplete="new-password" placeholder="至少 6 位" />
          </el-form-item>
          <el-form-item label="确认密码">
            <el-input v-model="password2" type="password" show-password autocomplete="new-password" />
          </el-form-item>
          <el-button type="primary" class="w100" :loading="loading" native-type="submit">注册</el-button>
        </el-form>
      </template>
      <el-divider />
      <router-link to="/login">返回登录</router-link>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { http } from '@/api/http.js';

const router = useRouter();
const username = ref('');
const password = ref('');
const password2 = ref('');
const loading = ref(false);
const opts = reactive({ allowRegistration: true });

onMounted(async () => {
  try {
    const { data } = await http.get('/api/auth/options');
    opts.allowRegistration = data.allowRegistration !== false;
  } catch {
    /* */
  }
});

async function submit() {
  if (password.value !== password2.value) {
    ElMessage.warning('两次密码不一致');
    return;
  }
  loading.value = true;
  try {
    await http.post('/api/auth/register', {
      username: username.value.trim(),
      password: password.value,
    });
    ElMessage.success('注册成功，请登录');
    await router.replace('/login');
  } catch {
    /* */
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
  width: min(440px, 100%);
  border-radius: 14px;
}
.auth-title {
  font-weight: 700;
  font-size: 16px;
}
.w100 {
  width: 100%;
}
</style>
