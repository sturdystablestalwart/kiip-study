import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
    gap: ${({ theme }) => theme.layout.space[4]}px;
`;

const Message = styled.p`
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;

export default function MagicLinkVerify() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { refreshUser } = useAuth();

    // Derive initial state synchronously from URL params
    const errorParam = searchParams.get('error');
    const [status, setStatus] = useState(errorParam ? 'error' : 'checking');
    const [errorCode, setErrorCode] = useState(errorParam || null);

    useEffect(() => {
        // If there was an error param, state is already set — nothing to do
        if (errorParam) return;

        let cancelled = false;
        refreshUser()
            .then(() => { if (!cancelled) { setStatus('success'); setTimeout(() => navigate('/'), 1000); } })
            .catch(() => { if (!cancelled) { setStatus('error'); setErrorCode('TOKEN_INVALID'); } });
        return () => { cancelled = true; };
    }, [errorParam, refreshUser, navigate]);

    const errorMessages = {
        TOKEN_EXPIRED: t('auth.verifyExpired'),
        TOKEN_USED: t('auth.verifyUsed'),
        TOKEN_INVALID: t('auth.verifyInvalid'),
    };

    if (status === 'checking' || status === 'success') {
        return <Container><Message>{t('auth.verifying')}</Message></Container>;
    }

    return (
        <Container>
            <Message>{errorMessages[errorCode] || errorMessages.TOKEN_INVALID}</Message>
            <Button onClick={() => navigate('/')}>
                {t('auth.goHome')}
            </Button>
        </Container>
    );
}
