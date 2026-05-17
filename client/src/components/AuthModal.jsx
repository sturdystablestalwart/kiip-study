import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import API_BASE_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import Modal from './ui/Modal';
import { Button as UiButton } from './ui';

const Title = styled.h2`
    font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text.primary};
    margin: 0 0 ${({ theme }) => theme.layout.space[6]}px;
    text-align: center;
`;

const Input = styled.input`
    width: 100%;
    height: ${({ theme }) => theme.layout.controlHeights.input}px;
    padding: 0 ${({ theme }) => theme.layout.space[4]}px;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    border-radius: ${({ theme }) => theme.layout.radius.sm}px;
    font-size: ${({ theme }) => theme.typography.scale.body.size}px;
    color: ${({ theme }) => theme.colors.text.primary};
    background: ${({ theme }) => theme.colors.bg.surface};
    box-sizing: border-box;
    &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.colors.accent.indigo};
        box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.accent.indigo}33;
    }
`;

const Divider = styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.layout.space[3]}px;
    margin: ${({ theme }) => theme.layout.space[5]}px 0;
    color: ${({ theme }) => theme.colors.text.faint};
    font-size: ${({ theme }) => theme.typography.scale.small.size}px;
    &::before, &::after {
        content: '';
        flex: 1;
        border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
    }
`;

const CheckEmailText = styled.p`
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.scale.body.size}px;
    text-align: center;
    margin: 0 0 ${({ theme }) => theme.layout.space[3]}px;
`;

const EmailHighlight = styled.span`
    color: ${({ theme }) => theme.colors.text.primary};
    font-weight: 500;
`;

const PrimaryAction = styled(UiButton)`
    width: 100%;
    margin-top: ${({ theme }) => theme.layout.space[4]}px;
`;

const SecondaryAction = styled(UiButton)`
    width: 100%;
    margin-top: ${({ theme }) => theme.layout.space[3]}px;
`;

const LinkButton = styled.button`
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.accent.indigo};
    font-size: ${({ theme }) => theme.typography.scale.small.size}px;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    &:disabled { color: ${({ theme }) => theme.colors.text.faint}; cursor: not-allowed; text-decoration: none; }
`;

const Actions = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.layout.space[3]}px;
    margin-top: ${({ theme }) => theme.layout.space[5]}px;
`;

function maskEmail(email) {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}${local[1]}***@${domain}`;
}

export default function AuthModal({ onClose }) {
    const { t, i18n } = useTranslation();
    const { user, refreshUser } = useAuth();
    const [state, setState] = useState('idle');
    const [email, setEmail] = useState('');
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // Poll for auth changes (user clicked magic link in another tab).
    // Issue #174 — was setInterval(3000), so a 10-minute pending link
    // burned 200 requests + DB hits per user.  Now:
    // - exponential backoff 3s → 6s → 12s → 30s cap
    // - pauses when document is hidden (no work while tab is in the
    //   background)
    // - resumes (and resets the backoff) on visibilitychange
    useEffect(() => {
        if (user) { onClose(); return; }

        let cancelled = false;
        let delay = 3000;
        const MAX_DELAY = 30000;
        let timer;

        const schedule = () => {
            if (cancelled) return;
            timer = setTimeout(async () => {
                if (cancelled) return;
                if (!document.hidden) {
                    try { await refreshUser(); } catch { /* ignore */ }
                    delay = Math.min(delay * 2, MAX_DELAY);
                }
                schedule();
            }, delay);
        };

        const onVisibility = () => {
            if (!document.hidden) {
                delay = 3000;
                if (timer) clearTimeout(timer);
                refreshUser().catch(() => {});
                schedule();
            }
        };

        schedule();
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [user, refreshUser, onClose]);

    const handleSend = useCallback(async () => {
        if (!email.trim() || !email.includes('@')) return;
        setState('sending');
        try {
            await api.post('/api/auth/magic/send', {
                email: email.trim().toLowerCase(),
                lang: i18n.language,
            });
            setState('checkEmail');
            setCooldown(60);
        } catch {
            setState('idle');
        }
    }, [email, i18n.language]);

    const handleResend = useCallback(async () => {
        setCooldown(60);
        try {
            await api.post('/api/auth/magic/send', {
                email: email.trim().toLowerCase(),
                lang: i18n.language,
            });
        } catch { /* silently fail */ }
    }, [email, i18n.language]);

    const handleGoogle = () => {
        window.location.href = `${API_BASE_URL}/api/auth/google/start`;
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && state === 'idle') handleSend();
    };

    return (
        <Modal onClose={onClose} maxWidth={400} ariaLabel={t('auth.signInTitle')}>
                {state === 'checkEmail' ? (
                    // Issue #175 — wrap the post-send state in a polite
                    // live region so screen readers announce the change.
                    // role="status" implies aria-live="polite" + atomic.
                    <div role="status" aria-live="polite">
                        <Title>{t('auth.checkEmail')}</Title>
                        <CheckEmailText>
                            {t('auth.checkEmailDesc')}{' '}
                            <EmailHighlight>{maskEmail(email)}</EmailHighlight>
                        </CheckEmailText>
                        <Actions>
                            <LinkButton onClick={handleResend} disabled={cooldown > 0}>
                                {cooldown > 0
                                    ? t('auth.resendIn', { seconds: cooldown })
                                    : t('auth.resend')}
                            </LinkButton>
                            <LinkButton onClick={() => { setState('idle'); setEmail(''); }}>
                                {t('auth.wrongEmail')}
                            </LinkButton>
                        </Actions>
                    </div>
                ) : (
                    <>
                        <Title>{t('auth.signInTitle')}</Title>
                        <Input
                            type="email"
                            placeholder={t('auth.emailPlaceholder')}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={state === 'sending'}
                            // Issue #175 — `autoFocus` fought the Modal's
                            // useFocusTrap initial focus call.  Modal will
                            // focus the first focusable element (this input)
                            // on its own, no duplicate dispatch.
                        />
                        <PrimaryAction onClick={handleSend} disabled={state === 'sending' || !email.includes('@')}>
                            {state === 'sending' ? '...' : t('auth.sendMagicLink')}
                        </PrimaryAction>
                        <Divider>{t('auth.or')}</Divider>
                        <SecondaryAction $variant="secondary" onClick={handleGoogle}>
                            {t('auth.signInWithGoogle')}
                        </SecondaryAction>
                    </>
                )}
        </Modal>
    );
}
