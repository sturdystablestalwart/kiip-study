import axios from 'axios';
import API_BASE_URL from '../config/api';
import { showToast } from '../components/Toast';
import i18n from '../i18n';

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
            showToast(i18n.t('common.sessionExpired'), 'warning', 6000);
        } else if (!error.response && error.code !== 'ECONNABORTED') {
            showToast(i18n.t('common.networkError'), 'error', 8000);
        }

        return Promise.reject(error);
    }
);

export default api;
