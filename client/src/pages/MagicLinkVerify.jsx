import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

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

const Button = styled.button`
    height: ${({ theme }) => theme.layout.controlHeights.button}px;
    padding: 0 ${({ theme }) => theme.layout.space[6]}px;
    background: ${({ theme }) => theme.colors.accent.clay};
    color: #fff;
    border: none;
    border-radius: ${({ theme }) => theme.layout.radius.sm}px;
    font-size: ${({ theme }) => theme.typography.scale.body.size}px;
    cursor: pointer;
    &:hover { opacity: 0.9; }
`;

export default function MagicLinkVerify() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { refreshUser } = useAuth();
    const [status, setStatus] = useState('checking');
    const [errorCode, setErrorCode] = useState(null);

    useEffect(() => {
        const error = searchParams.get('error');
        if (error) {
            setStatus('error');
            setErrorCode(error);
            return;
        }

        refreshUser()
            .then(() => {
                setStatus('success');
                setTimeout(() => navigate('/'), 1000);
            })
            .catch(() => {
                setStatus('error');
                setErrorCode('TOKEN_INVALID');
            });
    }, [searchParams, refreshUser, navigate]);

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
