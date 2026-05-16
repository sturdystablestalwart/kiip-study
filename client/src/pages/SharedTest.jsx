import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { Card as UICard, Badge } from '../components/ui';

/* ───────── Styled Components ───────── */

const Container = styled.div`
  max-width: 560px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.layout.space[8]}px 0;
`;

const Card = styled(UICard).attrs({ $radius: 'lg', $padding: 'lg' })`
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
  line-height: ${({ theme }) => theme.typography.scale.h2.line}px;
`;

const Description = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  margin: 0 0 ${({ theme }) => theme.layout.space[5]}px 0;
`;

const MetaRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const MetaBadge = styled(Badge)`
  padding: ${({ theme }) => theme.layout.space[1]}px ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const StartButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  background: ${({ theme }) => theme.colors.accent.clay};
  color: ${({ theme }) => theme.colors.bg.surface};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  text-decoration: none;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.accent.clayHover};
    color: ${({ theme }) => theme.colors.bg.surface};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const LoadingState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;

const ErrorState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;

  h2 {
    color: ${({ theme }) => theme.colors.text.muted};
    margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
  }

  p {
    color: ${({ theme }) => theme.colors.text.faint};
    margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
  }
`;

const HomeLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  text-decoration: none;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.border.subtle};
  }
`;

/* ───────── Component ───────── */

function SharedTest() {
  const { shareId } = useParams();
  const { t } = useTranslation();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchSharedTest = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/api/shared/${shareId}`, { signal: controller.signal });
        setTest(res.data);
      } catch (err) {
        if (err.name === 'CanceledError') return;
        if (err.response?.status === 404) {
          setError('notFound');
        } else {
          setError('generic');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchSharedTest();

    return () => controller.abort();
  }, [shareId]);

  if (loading) {
    return (
      <Container>
        <LoadingState>{t('common.loading')}</LoadingState>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorState>
          <h2>{error === 'notFound' ? t('shared.notFound') : t('common.error')}</h2>
          <p>{error === 'notFound' ? t('shared.notFoundDesc') : t('common.retry')}</p>
          <HomeLink to="/">{t('test.goHome')}</HomeLink>
        </ErrorState>
      </Container>
    );
  }

  return (
    <Container>
      <Card>
        <Title>{test.title}</Title>
        {test.description && <Description>{test.description}</Description>}
        <MetaRow>
          {test.level && <MetaBadge>{test.level}</MetaBadge>}
          {test.unitNumber != null && <MetaBadge>Unit {test.unitNumber}</MetaBadge>}
          {test.section && <MetaBadge>{test.section}</MetaBadge>}
          <MetaBadge>{t('home.questionsCount', { count: test.questionCount })}</MetaBadge>
        </MetaRow>
        <StartButton to={`/test/${test._id}`}>
          {t('shared.startPractice')}
        </StartButton>
      </Card>
    </Container>
  );
}

export default SharedTest;
