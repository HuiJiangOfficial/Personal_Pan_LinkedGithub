import axios from 'axios';
import { presentApiError } from '@/errors/presentError.js';

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
    if (err.config?.skipGlobalErrorHandler === true) {
      return Promise.reject(err);
    }
    void presentApiError(err, { from: 'http' });
    return Promise.reject(err);
  }
);

export default http;
