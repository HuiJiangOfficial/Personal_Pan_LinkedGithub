import axios from 'axios';
import { ElMessage } from 'element-plus';

export const http = axios.create({
  baseURL: '',
  timeout: 120000,
  withCredentials: true,
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
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

export default http;
