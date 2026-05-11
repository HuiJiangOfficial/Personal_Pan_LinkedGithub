import axios from 'axios';
import { ElMessage } from 'element-plus';

const STORAGE_KEY = 'github_web_pan_pwd';

export function getStoredPassword() {
  return sessionStorage.getItem(STORAGE_KEY) || '';
}

export function setStoredPassword(pwd) {
  if (pwd) sessionStorage.setItem(STORAGE_KEY, pwd);
  else sessionStorage.removeItem(STORAGE_KEY);
}

export const http = axios.create({
  baseURL: '',
  timeout: 120000,
});

http.interceptors.request.use((config) => {
  const pwd = getStoredPassword();
  if (pwd) {
    config.headers = config.headers || {};
    config.headers['X-Site-Password'] = pwd;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err?.response?.data?.error || err.message || '请求失败';
    if (err?.response?.status === 401) {
      ElMessage.error(msg);
    }
    return Promise.reject(err);
  }
);
