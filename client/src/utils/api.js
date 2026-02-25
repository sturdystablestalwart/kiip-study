import axios from 'axios';
import API_BASE_URL from '../config/api';
import { showToast } from '../components/Toast';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isCancel(error)) return Promise.reject(error);

        const status = error.response?.status;
        const url = error.config?.url || '';

        if (status === 401 && !url.includes('/api/auth/me')) {
            window.dispatchEvent(new CustomEvent('auth:expired'));
            showToast('Session expired \u2014 please sign in again', 'warning', 6000);
        } else if (!error.response && error.code !== 'ECONNABORTED') {
            showToast('Cannot reach the server. Check your connection.', 'error', 8000);
        }

        return Promise.reject(error);
    }
);

export default api;
