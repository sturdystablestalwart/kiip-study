import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import QuestionRenderer from '../components/QuestionRenderer';
import { scoreQuestion } from '../utils/scoring';
import { Button, Card } from '../components/ui';

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[6]}px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[4]}px;
`;

const Stats = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[5]}px;
  flex-wrap: wrap;
`;

const Stat = styled.div`
  text-align: center;

  strong {
    display: block;
    font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
    color: ${({ $color, theme }) =>
      $color === 'moss' ? theme.colors.accent.moss : theme.colors.text.primary};
  }

  span {
    font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
    color: ${({ theme }) => theme.colors.text.faint};
  }
`;

const QuestionCard = styled(Card).attrs({ $padding: 'lg' })`
`;

const SourceLabel = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
`;

const QuestionText = styled.h3`
  margin: 0 0 ${({ theme }) => theme.layout.space[4]}px 0;
`;

const NavControls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[4]}px;
  margin-top: ${({ theme }) => theme.layout.space[4]}px;
`;

// NavButton uses Button primitive; $primary prop maps to accent (indigo) vs secondary variant
const NavButton = styled(Button).attrs(({ $primary }) => ({
  $variant: $primary ? 'accent' : 'secondary',
}))`
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px;
  color: ${({ theme }) => theme.colors.text.muted};

  h2 {
    margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
  }
`;

export default function FailedQuestions() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(!!user);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showFeedback, setShowFeedback] = useState({});
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const fetchFailed = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/review/failed?limit=30', { signal: controller.signal });
        setQuestions(res.data.questions);
      } catch (err) {
        if (err.name === 'CanceledError') return;
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFailed();
    return () => controller.abort();
  }, [user]);

  const handleAnswer = useCallback(
    answer => {
      setAnswers(prev => ({ ...prev, [currentIdx]: answer }));
    },
    [currentIdx]
  );

  const handleCheck = () => {
    const q = questions[currentIdx];
    const ans = answers[currentIdx];
    const isCorrect = scoreQuestion(q, ans);
    if (isCorrect) setCorrectCount(prev => prev + 1);
    setShowFeedback(prev => ({ ...prev, [currentIdx]: true }));
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) setCurrentIdx(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentIdx > 0) setCurrentIdx(prev => prev - 1);
  };

  if (!user)
    return (
      <EmptyState>
        <h2>{t('common.loginRequired')}</h2>
      </EmptyState>
    );
  if (loading)
    return (
      <EmptyState>
        <p>{t('common.loading')}</p>
      </EmptyState>
    );
  if (questions.length === 0)
    return (
      <EmptyState>
        <h2>{t('review.noFailed')}</h2>
        <p>{t('review.noFailedDesc')}</p>
        <NavButton onClick={() => navigate('/')}>{t('test.goHome')}</NavButton>
      </EmptyState>
    );

  const q = questions[currentIdx];
  const hasFeedback = showFeedback[currentIdx];
  const hasAnswer = !!answers[currentIdx];

  return (
    <Page>
      <Header>
        <h1>{t('review.title')}</h1>
        <Stats>
          <Stat $color="moss">
            <strong>{correctCount}</strong>
            <span>{t('test.correct')}</span>
          </Stat>
          <Stat>
            <strong>
              {currentIdx + 1}/{questions.length}
            </strong>
            <span>{t('test.question', { current: currentIdx + 1, total: questions.length })}</span>
          </Stat>
        </Stats>
      </Header>

      <QuestionCard>
        <SourceLabel>{q._sourceTestTitle}</SourceLabel>
        <QuestionText>
          {currentIdx + 1}. {q.text}
        </QuestionText>
        <QuestionRenderer
          question={q}
          answer={answers[currentIdx] || {}}
          onAnswer={handleAnswer}
          showFeedback={hasFeedback}
          disabled={hasFeedback}
        />
        <NavControls>
          <NavButton onClick={handlePrev} disabled={currentIdx === 0}>
            {t('test.previous')}
          </NavButton>
          {!hasFeedback && (
            <NavButton $primary onClick={handleCheck} disabled={!hasAnswer}>
              {t('review.check')}
            </NavButton>
          )}
          {hasFeedback && currentIdx < questions.length - 1 && (
            <NavButton $primary onClick={handleNext}>
              {t('test.next')}
            </NavButton>
          )}
          {hasFeedback && currentIdx === questions.length - 1 && (
            <NavButton $primary onClick={() => navigate('/dashboard')}>
              {t('review.finish')}
            </NavButton>
          )}
        </NavControls>
      </QuestionCard>
    </Page>
  );
}
