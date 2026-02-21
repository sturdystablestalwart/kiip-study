import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import QuestionRenderer from '../components/QuestionRenderer';
import { scoreQuestion } from '../utils/scoring';
import FilterDropdown from '../components/FilterDropdown';

/* ───────── Styled Components ───────── */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[6]}px;
`;

/* ── Start Screen ── */

const StartScreen = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[8]}px;
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  text-align: center;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.md};
  max-width: 520px;
  margin: ${({ theme }) => theme.layout.space[8]}px auto 0;
  width: 100%;
`;

const StartTitle = styled.h2`
  margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const StartDescription = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  margin: 0 0 ${({ theme }) => theme.layout.space[6]}px 0;
`;

const FilterRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
  flex-wrap: wrap;
`;

const StartButton = styled.button`
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[7]}px;
  background: ${({ theme }) => theme.colors.accent.clay};
  color: ${({ theme }) => theme.colors.bg.surface};
  border: none;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover:not(:disabled) {
    background: #8B5340;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }
`;

/* ── Session Header ── */

const SessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
  gap: ${({ theme }) => theme.layout.space[4]}px;
  flex-wrap: wrap;
`;

const StatsBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  align-items: center;
  flex-wrap: wrap;
`;

const StatBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[1]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  padding: ${({ theme }) => theme.layout.space[1]}px ${({ theme }) => theme.layout.space[3]}px;
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-variant-numeric: tabular-nums;
`;

const StatValue = styled.span`
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ $color, theme }) => $color || theme.colors.text.primary};
`;

const AccuracyValue = styled.span`
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ $totalAnswered, $accuracy, theme }) => {
    if (!$totalAnswered) return theme.colors.text.primary;
    if ($accuracy >= 70) return theme.colors.accent.moss;
    if ($accuracy >= 50) return theme.colors.state.warning;
    return theme.colors.state.danger;
  }};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[4]}px;
`;

const TimerDisplay = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.accent.indigo};
  font-variant-numeric: tabular-nums;
`;

const EndButton = styled.button`
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.state.danger};
  border: 1px solid ${({ theme }) => theme.colors.state.danger};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.state.danger};
    color: ${({ theme }) => theme.colors.bg.surface};
  }
`;

/* ── Question Card ── */

const QuestionCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[7]}px;
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};

  @media (max-width: 600px) {
    padding: ${({ theme }) => theme.layout.space[5]}px;
  }
`;

const QuestionImage = styled.img`
  max-width: 100%;
  max-height: 300px;
  display: block;
  margin: 0 auto ${({ theme }) => theme.layout.space[6]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
`;

const QuestionText = styled.h2`
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
  line-height: ${({ theme }) => theme.typography.scale.h2.line}px;
`;

const Controls = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: ${({ theme }) => theme.layout.space[6]}px;
`;

const NextButton = styled.button`
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  background: ${({ theme }) => theme.colors.accent.indigo};
  color: ${({ theme }) => theme.colors.bg.surface};
  border: none;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }
`;

/* ── Loading ── */

const LoadingScreen = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[8]}px;
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  text-align: center;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
  color: ${({ theme }) => theme.colors.text.faint};
`;

/* ── End Screen ── */

const EndScreen = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[7]}px;
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  text-align: center;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.md};
  max-width: 520px;
  margin: ${({ theme }) => theme.layout.space[8]}px auto 0;
  width: 100%;

  h2 {
    margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

const FinalScore = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.h1.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h1.weight};
  color: ${({ $accuracy, theme }) => {
    if ($accuracy >= 70) return theme.colors.accent.moss;
    if ($accuracy >= 50) return theme.colors.state.warning;
    return theme.colors.state.danger;
  }};
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const FinalStats = styled.div`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const EndActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  justify-content: center;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  border: none;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.9;
  }
`;

const PrimaryAction = styled(ActionButton)`
  background: ${({ theme }) => theme.colors.accent.clay};
  color: ${({ theme }) => theme.colors.bg.surface};
`;

const SecondaryAction = styled(ActionButton)`
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

/* ── Empty State ── */

const EmptyState = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[8]}px;
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  text-align: center;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};

  h3 {
    margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
    color: ${({ theme }) => theme.colors.text.primary};
  }

  p {
    color: ${({ theme }) => theme.colors.text.muted};
    margin: 0 0 ${({ theme }) => theme.layout.space[5]}px 0;
  }
`;

/* ───────── Helpers ───────── */

const LEVEL_OPTIONS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
const UNIT_OPTIONS = Array.from({ length: 20 }, (_, i) => `Unit ${i + 1}`);

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/* ───────── Component ───────── */

function EndlessMode() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [excludeKeys, setExcludeKeys] = useState([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const timerRef = useRef(null);
  const sessionDurationRef = useRef(0);

  // Keep ref in sync for use in submitChunk
  useEffect(() => {
    sessionDurationRef.current = sessionDuration;
  }, [sessionDuration]);

  // Timer: counts up while session is active
  useEffect(() => {
    if (started && !ended) {
      timerRef.current = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [started, ended]);

  const fetchBatch = useCallback(async (excludeList) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (levelFilter) params.set('level', levelFilter);
      if (unitFilter) params.set('unit', unitFilter);
      const keysToExclude = excludeList || excludeKeys;
      if (keysToExclude.length) params.set('exclude', keysToExclude.join(','));
      params.set('limit', '10');

      const res = await api.get(`/api/tests/endless?${params}`, { timeout: 10000 });
      setQuestions(res.data.questions);
      setRemaining(res.data.remaining);
      setCurrentIdx(0);
      setAnswers({});
    } catch (err) {
      console.error('Failed to fetch endless batch:', err);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [levelFilter, unitFilter, excludeKeys]);

  const submitChunk = useCallback(async (chunkQuestions, chunkAnswers) => {
    const qs = chunkQuestions || questions;
    const ans = chunkAnswers || answers;

    const formattedAnswers = qs.map((q, i) => {
      const a = ans[i];
      return {
        questionIndex: i,
        selectedOptions: a?.selectedOptions,
        textAnswer: a?.textAnswer,
        orderedItems: a?.orderedItems,
        blankAnswers: a?.blankAnswers,
        isCorrect: a ? scoreQuestion(q, a) : false,
        isOverdue: false
      };
    });

    const sourceQuestions = qs.map(q => ({
      testId: q._sourceTestId,
      questionIndex: q._sourceIndex
    }));

    try {
      await api.post('/api/tests/endless/attempt', {
        answers: formattedAnswers,
        duration: sessionDurationRef.current,
        sourceQuestions
      });
    } catch (err) {
      console.error('Failed to save endless attempt:', err);
    }
  }, [questions, answers]);

  const handleStart = () => {
    setStarted(true);
    fetchBatch([]);
  };

  const handleAnswer = (answerData) => {
    setAnswers(prev => ({ ...prev, [currentIdx]: answerData }));
  };

  const handleNext = () => {
    const q = questions[currentIdx];
    const ans = answers[currentIdx];
    const correct = ans ? scoreQuestion(q, ans) : false;
    setTotalAnswered(prev => prev + 1);
    if (correct) setTotalCorrect(prev => prev + 1);

    // Add to exclude list (rolling window of 30)
    const key = q._sourceKey;
    const updatedKeys = [...excludeKeys, key];
    const trimmedKeys = updatedKeys.length > 30 ? updatedKeys.slice(-30) : updatedKeys;
    setExcludeKeys(trimmedKeys);

    // Check if batch complete
    if (currentIdx >= questions.length - 1) {
      submitChunk();
      fetchBatch(trimmedKeys);
    } else {
      setCurrentIdx(prev => prev + 1);
    }
  };

  const handleEnd = () => {
    if (Object.keys(answers).length > 0) {
      submitChunk();
    }
    setEnded(true);
  };

  const handleNewSession = () => {
    setStarted(false);
    setLoading(false);
    setQuestions([]);
    setCurrentIdx(0);
    setAnswers({});
    setTotalAnswered(0);
    setTotalCorrect(0);
    setExcludeKeys([]);
    setLevelFilter('');
    setUnitFilter('');
    setSessionDuration(0);
    setEnded(false);
    setRemaining(0);
  };

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // ── Start Screen ──
  if (!started) {
    return (
      <Page>
        <StartScreen>
          <StartTitle>{t('endless.title')}</StartTitle>
          <StartDescription>
            {t('home.endlessDesc')}
          </StartDescription>
          <FilterRow>
            <FilterDropdown
              label={t('home.allLevels')}
              value={levelFilter}
              options={LEVEL_OPTIONS}
              onChange={setLevelFilter}
            />
            <FilterDropdown
              label={t('home.allUnits')}
              value={unitFilter}
              options={UNIT_OPTIONS}
              onChange={setUnitFilter}
            />
          </FilterRow>
          <StartButton onClick={handleStart}>{t('endless.start')}</StartButton>
        </StartScreen>
      </Page>
    );
  }

  // ── End Screen ──
  if (ended) {
    return (
      <Page>
        <EndScreen>
          <h2>{t('test.results')}</h2>
          <FinalScore $accuracy={accuracy}>
            {accuracy}%
          </FinalScore>
          <FinalStats>
            {t('test.correct')}: {totalCorrect}/{totalAnswered}
            <br />
            {t('test.duration')}: {formatDuration(sessionDuration)}
          </FinalStats>
          <EndActions>
            <PrimaryAction onClick={handleNewSession}>{t('endless.start')}</PrimaryAction>
            <SecondaryAction onClick={() => navigate('/')}>{t('test.goHome')}</SecondaryAction>
          </EndActions>
        </EndScreen>
      </Page>
    );
  }

  // ── Loading State ──
  if (loading && questions.length === 0) {
    return (
      <Page>
        <LoadingScreen>{t('common.loading')}</LoadingScreen>
      </Page>
    );
  }

  // ── Empty Pool ──
  if (!loading && questions.length === 0) {
    return (
      <Page>
        <EmptyState>
          <h3>{t('home.noTests')}</h3>
          <p>{t('home.endlessDesc')}</p>
          <PrimaryAction onClick={handleNewSession}>{t('endless.start')}</PrimaryAction>
        </EmptyState>
      </Page>
    );
  }

  const currentQuestion = questions[currentIdx];
  const currentAnswer = answers[currentIdx];
  const showFeedback = currentAnswer !== undefined;

  return (
    <Page>
      <SessionHeader>
        <StatsBar>
          <StatBadge>
            {t('endless.questionsAnswered')}: <StatValue>{totalAnswered}</StatValue>
          </StatBadge>
          <StatBadge>
            {t('test.correct')}: <StatValue>{totalCorrect}</StatValue>
          </StatBadge>
          <StatBadge>
            {t('endless.accuracy')}:{' '}
            <AccuracyValue $totalAnswered={totalAnswered} $accuracy={accuracy}>
              {totalAnswered > 0 ? `${accuracy}%` : '--'}
            </AccuracyValue>
          </StatBadge>
          <StatBadge>
            <StatValue>{remaining}</StatValue>
          </StatBadge>
        </StatsBar>
        <HeaderRight>
          <TimerDisplay>{formatDuration(sessionDuration)}</TimerDisplay>
          <EndButton onClick={handleEnd}>{t('endless.quit')}</EndButton>
        </HeaderRight>
      </SessionHeader>

      <QuestionCard>
        {currentQuestion.image && (
          <QuestionImage
            src={currentQuestion.image.startsWith('http') ? currentQuestion.image : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${currentQuestion.image}`}
            alt="Question visual"
          />
        )}
        <QuestionText>{totalAnswered + 1}. {currentQuestion.text}</QuestionText>
        <QuestionRenderer
          question={currentQuestion}
          answer={currentAnswer}
          onAnswer={handleAnswer}
          showFeedback={showFeedback}
          disabled={showFeedback}
        />

        {showFeedback && (
          <Controls>
            <NextButton onClick={handleNext}>{t('test.next')}</NextButton>
          </Controls>
        )}
      </QuestionCard>

      {loading && <LoadingScreen>{t('common.loading')}</LoadingScreen>}
    </Page>
  );
}

export default EndlessMode;
