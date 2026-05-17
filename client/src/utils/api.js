import axios from 'axios';
import API_BASE_URL from '../config/api';
import { showToast } from '../components/Toast';
import i18n from '../i18n';

// Issue #171 — axios singleton ships a default 15s timeout so a hung
// backend can't pend UI promises indefinitely.  Legitimately slow
// endpoints (PDF generation, bulk import confirm) pass an explicit
// `{ timeout: 60000 }` per request.
const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 15000,
});

// Module-scoped latch: when the session cookie expires, every in-flight
// request returns 401 simultaneously. Without this, each one would fire its
// own "session expired" toast and `auth:expired` event, flooding the viewport
// and clearing AuthContext N times. We allow the first 401 wave to fire side
// effects, then suppress duplicates for 5s before re-arming. See issue #121.
let sessionExpiredShown = false;

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Issue #190 — axios.isCancel covers CancelToken-style cancels,
        // but AbortController/AbortSignal cancellations may surface as
        // err.name === 'CanceledError' (axios >=1.4) or 'AbortError'
        // (raw fetch).  Any of these mean the caller voluntarily
        // aborted; we must not show the network-error toast.
        if (
            axios.isCancel(error) ||
            error?.name === 'CanceledError' ||
            error?.name === 'AbortError' ||
            error?.code === 'ERR_CANCELED'
        ) {
            return Promise.reject(error);
        }

        const status = error.response?.status;
        const url = error.config?.url || '';

        if (status === 401 && !url.includes('/api/auth/me') && !sessionExpiredShown) {
            sessionExpiredShown = true;
            window.dispatchEvent(new CustomEvent('auth:expired'));
            showToast(i18n.t('common.sessionExpired'), 'warning', 6000);
            setTimeout(() => { sessionExpiredShown = false; }, 5000);
        } else if (!error.response && error.code !== 'ECONNABORTED') {
            showToast(i18n.t('common.networkError'), 'error', 8000);
        }

        return Promise.reject(error);
    }
);

export default api;
