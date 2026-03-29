import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Overlay = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: ${({ theme }) => theme.layout.space[4]}px;
`;

const Card = styled.div`
    background: ${({ theme }) => theme.colors.bg.surface};
    border-radius: ${({ theme }) => theme.layout.radius.lg}px;
    padding: ${({ theme }) => theme.layout.space[8]}px;
    max-width: 400px;
    width: 100%;
    box-shadow: ${({ theme }) => theme.layout.shadow.md};
`;

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

const Button = styled.button`
    width: 100%;
    height: ${({ theme }) => theme.layout.controlHeights.button}px;
    border: none;
    border-radius: ${({ theme }) => theme.layout.radius.sm}px;
    font-size: ${({ theme }) => theme.typography.scale.body.size}px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity ${({ theme }) => theme.motion.fast}ms ease-out;
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const PrimaryButton = styled(Button)`
    background: ${({ theme }) => theme.colors.accent.clay};
    color: #fff;
    margin-top: ${({ theme }) => theme.layout.space[4]}px;
    &:hover:not(:disabled) { opacity: 0.9; }
`;

const GoogleButton = styled(Button)`
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    color: ${({ theme }) => theme.colors.text.primary};
    margin-top: ${({ theme }) => theme.layout.space[3]}px;
    &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.bg.surfaceAlt}; }
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

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Poll for auth changes (user clicked magic link in another tab)
    useEffect(() => {
        if (user) { onClose(); return; }
        const interval = setInterval(() => refreshUser(), 3000);
        return () => clearInterval(interval);
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
        window.location.href = '/api/auth/google/start';
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && state === 'idle') handleSend();
    };

    return (
        <Overlay onClick={onClose} role="dialog" aria-modal="true" aria-label={t('auth.signInTitle')}>
            <Card onClick={e => e.stopPropagation()}>
                {state === 'checkEmail' ? (
                    <>
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
                    </>
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
                            autoFocus
                        />
                        <PrimaryButton onClick={handleSend} disabled={state === 'sending' || !email.includes('@')}>
                            {state === 'sending' ? '...' : t('auth.sendMagicLink')}
                        </PrimaryButton>
                        <Divider>{t('auth.or')}</Divider>
                        <GoogleButton onClick={handleGoogle}>
                            {t('auth.signInWithGoogle')}
                        </GoogleButton>
                    </>
                )}
            </Card>
        </Overlay>
    );
}
