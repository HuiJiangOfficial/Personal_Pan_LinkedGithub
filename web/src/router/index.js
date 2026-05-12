import { createRouter, createWebHistory } from 'vue-router';
import { http } from '@/api/http.js';

const LoginView = () => import('@/views/LoginView.vue');
const RegisterView = () => import('@/views/RegisterView.vue');
const DriveHome = () => import('@/views/DriveHome.vue');
const AdminView = () => import('@/views/AdminView.vue');

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/drive' },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/register', name: 'register', component: RegisterView, meta: { public: true } },
    {
      path: '/drive',
      name: 'drive',
      component: DriveHome,
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  if (to.meta.public) {
    return next();
  }
  try {
    const { data } = await http.get('/api/auth/me', { skipGlobalErrorHandler: true });
    if (!data?.authenticated) {
      return next({ path: '/login', query: { redirect: to.fullPath } });
    }
    if (to.meta.requiresAdmin && data.role !== 'admin') {
      return next({ path: '/drive' });
    }
    return next();
  } catch {
    return next({ path: '/login', query: { redirect: to.fullPath } });
  }
});

export default router;
