import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import API_BASE_URL from '../config/api';

/* ───────── Styled Components ───────── */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[6]}px;
`;

/* ── Header ── */

const HeaderBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
  gap: ${({ theme }) => theme.layout.space[4]}px;
  flex-wrap: wrap;
`;

const HeaderLeft = styled.div`
  flex: 1;
  min-width: 200px;
`;

const TestTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
`;

const ModeRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  align-items: center;
`;

const ModeLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
`;

const ModeSelect = styled.select`
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  background: ${({ theme }) => theme.colors.bg.surface};
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent.indigo};
  }
`;

const HeaderRight = styled.div`
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${({ theme }) => theme.layout.space[2]}px;
`;

const TimerDisplay = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ $expired, theme }) => $expired ? theme.colors.state.warning : theme.colors.accent.indigo};
  font-variant-numeric: tabular-nums;
`;

const ExitButton = styled.button`
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.selection.bg};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

/* ── Result card ── */

const ResultCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[7]}px;
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  text-align: center;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.md};

  h2 {
    margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

const ScorePercentage = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.h1.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h1.weight};
  color: ${({ theme }) => theme.colors.accent.moss};
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const OverdueNote = styled.p`
  color: ${({ theme }) => theme.colors.state.warning};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  margin: ${({ theme }) => theme.layout.space[3]}px auto 0;
`;

/* ── Question card ── */

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

const OptionsGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const OptionButton = styled.button`
  min-height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  text-align: left;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  background: ${({ $isCorrect, $selected, $submitted, theme }) => {
    if ($isCorrect && $submitted) return theme.colors.state.correctBg;
    if ($selected && $submitted && !$isCorrect) return theme.colors.state.wrongBg;
    if ($selected) return theme.colors.selection.bg;
    return theme.colors.bg.surface;
  }};

  border: 1px solid ${({ $isCorrect, $selected, $submitted, theme }) => {
    if ($isCorrect && $submitted) return theme.colors.state.success;
    if ($selected && $submitted && !$isCorrect) return theme.colors.state.danger;
    if ($selected) return theme.colors.accent.indigo;
    return theme.colors.border.subtle;
  }};

  color: ${({ theme }) => theme.colors.text.primary};

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    background: ${({ $selected, $submitted, theme }) => {
      if ($submitted) return undefined;
      if ($selected) return theme.colors.selection.bg;
      return theme.colors.bg.surfaceAlt;
    }};
  }

  &:disabled {
    cursor: default;
  }
`;

const ExplanationPanel = styled.div`
  margin-top: ${({ theme }) => theme.layout.space[6]}px;
  padding: ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.state.infoBg};
  border-left: 4px solid ${({ theme }) => theme.colors.accent.indigo};
  border-radius: 0 ${({ theme }) => theme.layout.radius.sm}px ${({ theme }) => theme.layout.radius.sm}px 0;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  color: ${({ theme }) => theme.colors.text.primary};

  strong {
    color: ${({ theme }) => theme.colors.accent.indigo};
  }
`;

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.layout.space[6]}px;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const NavButton = styled.button`
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  background: ${({ $primary, theme }) => $primary ? theme.colors.accent.indigo : 'transparent'};
  color: ${({ $primary, theme }) => $primary ? theme.colors.bg.surface : theme.colors.accent.indigo};
  border: ${({ $primary, theme }) => $primary ? 'none' : `1px solid ${theme.colors.accent.indigo}`};

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    ${({ $primary }) => $primary
      ? 'opacity: 0.9;'
      : ''
    }
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }
`;

const SubmitButton = styled(NavButton)`
  background: ${({ theme }) => theme.colors.accent.clay};
  color: ${({ theme }) => theme.colors.bg.surface};
  border: none;

  &:hover:not(:disabled) {
    background: #8B5340;
  }
`;

const BackToTestsButton = styled(NavButton)`
  margin-top: ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.accent.clay};
  color: ${({ theme }) => theme.colors.bg.surface};
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    background: #8B5340;
  }
`;

/* ── Question navigation dots ── */

const QuestionNav = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  margin-top: ${({ theme }) => theme.layout.space[5]}px;
  padding-top: ${({ theme }) => theme.layout.space[5]}px;
  border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const QuestionDot = styled.button`
  width: 34px;
  height: 34px;
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  border: 1px solid ${({ $current, $answered, theme }) => {
    if ($current) return theme.colors.accent.indigo;
    if ($answered) return theme.colors.accent.moss;
    return theme.colors.border.subtle;
  }};

  background: ${({ $current, $answered, theme }) => {
    if ($current) return theme.colors.accent.indigo;
    if ($answered) return theme.colors.state.correctBg;
    return theme.colors.bg.surface;
  }};

  color: ${({ $current, theme }) => $current ? theme.colors.bg.surface : theme.colors.text.muted};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
  }
`;

/* ── Status screens ── */

const StatusScreen = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[8]}px;
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  text-align: center;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
`;

const ErrorScreen = styled(StatusScreen)`
  h2 {
    color: ${({ theme }) => theme.colors.state.danger};
    margin: 0 0 ${({ theme }) => theme.layout.space[4]}px 0;
  }

  p {
    color: ${({ theme }) => theme.colors.text.muted};
    margin: 0 auto ${({ theme }) => theme.layout.space[5]}px;
  }
`;

const LoadingScreen = styled(StatusScreen)`
  color: ${({ theme }) => theme.colors.text.faint};
`;

/* ── Modals ── */

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(31, 35, 40, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[7]}px;
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  max-width: 420px;
  width: 90%;
  text-align: center;
  box-shadow: ${({ theme }) => theme.layout.shadow.md};

  h3 {
    margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
    color: ${({ theme }) => theme.colors.text.primary};
  }

  p {
    color: ${({ theme }) => theme.colors.text.muted};
    margin: 0 auto ${({ theme }) => theme.layout.space[5]}px;
    font-size: ${({ theme }) => theme.typography.scale.small.size}px;
    line-height: ${({ theme }) => theme.typography.scale.small.line}px;
  }
`;

const ModalActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  justify-content: center;
`;

const ModalBtn = styled.button`
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  cursor: pointer;
  border: none;
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover { opacity: 0.9; }
`;

const ModalBtnSecondary = styled(ModalBtn)`
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const ModalBtnPrimary = styled(ModalBtn)`
  background: ${({ theme }) => theme.colors.accent.indigo};
  color: ${({ theme }) => theme.colors.bg.surface};
`;

const ModalBtnDanger = styled(ModalBtn)`
  background: ${({ theme }) => theme.colors.state.danger};
  color: ${({ theme }) => theme.colors.bg.surface};
`;

/* ───────── Component ───────── */

function TestTaker() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('Test');
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);
  const [overdueSeconds, setOverdueSeconds] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/tests/${id}`, {
          timeout: 10000
        });
        setTest(res.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Could not load this test. It may have been removed or the server is unavailable.');
      }
    };
    fetchTest();
  }, [id]);

  useEffect(() => {
    if (isSubmitted || !test) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          setTimerExpired(true);
          setOverdueSeconds(os => os + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted, test]);

  const hasProgress = Object.keys(answers).length > 0;

  const handleBeforeUnload = useCallback((e) => {
    if (!isSubmitted && hasProgress) {
      e.preventDefault();
      e.returnValue = '';
    }
  }, [isSubmitted, hasProgress]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSelect = (idx) => {
    if (isSubmitted) return;
    setAnswers({
      ...answers,
      [currentQ]: {
        index: idx,
        overdue: timerExpired
      }
    });
  };

  const handleModeChange = (newMode) => {
    if (hasProgress) {
      setPendingMode(newMode);
      setShowModeModal(true);
    } else {
      setMode(newMode);
    }
  };

  const confirmModeChange = () => {
    setAnswers({});
    setCurrentQ(0);
    setMode(pendingMode);
    setShowModeModal(false);
    setPendingMode(null);
  };

  const cancelModeChange = () => {
    setShowModeModal(false);
    setPendingMode(null);
  };

  const handleSubmit = async () => {
    let correctCount = 0;
    const submissionAnswers = test.questions.map((q, idx) => {
      const ans = answers[idx];
      const isCorrect = ans !== undefined && q.options[ans.index]?.isCorrect;
      if (isCorrect) correctCount++;
      return {
        questionIndex: idx,
        selectedOption: ans?.index ?? -1,
        isCorrect,
        isOverdue: ans?.overdue ?? false
      };
    });

    setScore(correctCount);
    setIsSubmitted(true);

    try {
      await axios.post(`${API_BASE_URL}/api/tests/${id}/attempt`, {
        score: correctCount,
        totalQuestions: test.questions.length,
        duration: (30 * 60) - timeLeft,
        overdueTime: overdueSeconds,
        answers: submissionAnswers,
        mode
      });
    } catch (err) {
      console.error("Failed to save attempt", err);
    }
  };

  const handleExitClick = () => {
    if (hasProgress && !isSubmitted) {
      setShowExitModal(true);
    } else {
      navigate('/');
    }
  };

  const confirmExit = () => {
    navigate('/');
  };

  const cancelExit = () => {
    setShowExitModal(false);
  };

  // Error state
  if (error) {
    return (
      <ErrorScreen>
        <h2>Couldn't load this test</h2>
        <p>{error}</p>
        <NavButton $primary onClick={() => navigate('/')}>Back to tests</NavButton>
      </ErrorScreen>
    );
  }

  // Loading state
  if (!test) {
    return <LoadingScreen>Loading your test...</LoadingScreen>;
  }

  const currentQuestion = test.questions[currentQ];
  const currentAnswer = answers[currentQ];
  const showFeedback = mode === 'Practice' ? (currentAnswer !== undefined) : isSubmitted;
  const percentage = Math.round((score / test.questions.length) * 100);

  return (
    <Page>
      <HeaderBar>
        <HeaderLeft>
          <TestTitle>{test.title}</TestTitle>
          <ModeRow>
            <ModeLabel>Mode:</ModeLabel>
            <ModeSelect
              value={mode}
              onChange={(e) => handleModeChange(e.target.value)}
              disabled={isSubmitted}
            >
              <option value="Test">Test (submit at end)</option>
              <option value="Practice">Practice (instant feedback)</option>
            </ModeSelect>
          </ModeRow>
        </HeaderLeft>
        <HeaderRight>
          <TimerDisplay $expired={timerExpired}>
            {timerExpired ? `+${formatTime(overdueSeconds)}` : formatTime(timeLeft)}
          </TimerDisplay>
          <ExitButton onClick={handleExitClick}>
            Exit
          </ExitButton>
        </HeaderRight>
      </HeaderBar>

      {isSubmitted && (
        <ResultCard>
          <h2>You got {score} out of {test.questions.length}</h2>
          <ScorePercentage>{percentage}%</ScorePercentage>
          {overdueSeconds > 0 && (
            <OverdueNote>
              You went over by {formatTime(overdueSeconds)}.
            </OverdueNote>
          )}
          <BackToTestsButton onClick={() => navigate('/')}>
            Back to tests
          </BackToTestsButton>
        </ResultCard>
      )}

      <QuestionCard>
        {currentQuestion.image && (
          <QuestionImage
            src={currentQuestion.image.startsWith('http') ? currentQuestion.image : `${API_BASE_URL}${currentQuestion.image}`}
            alt="Question visual"
          />
        )}
        <QuestionText>{currentQ + 1}. {currentQuestion.text}</QuestionText>
        <OptionsGrid>
          {currentQuestion.options.map((opt, idx) => (
            <OptionButton
              key={idx}
              $selected={currentAnswer?.index === idx}
              $isCorrect={opt.isCorrect}
              $submitted={showFeedback}
              onClick={() => handleSelect(idx)}
              disabled={isSubmitted}
            >
              {idx + 1}. {opt.text}
            </OptionButton>
          ))}
        </OptionsGrid>

        {showFeedback && currentQuestion.explanation && (
          <ExplanationPanel>
            <strong>Why?</strong> {currentQuestion.explanation}
          </ExplanationPanel>
        )}

        <Controls>
          <NavButton onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>
            Previous
          </NavButton>
          {currentQ < test.questions.length - 1 ? (
            <NavButton $primary onClick={() => setCurrentQ(currentQ + 1)}>Next</NavButton>
          ) : (
            <SubmitButton onClick={handleSubmit} disabled={isSubmitted}>
              Submit
            </SubmitButton>
          )}
        </Controls>

        <QuestionNav>
          {test.questions.map((_, idx) => (
            <QuestionDot
              key={idx}
              $current={idx === currentQ}
              $answered={answers[idx] !== undefined}
              onClick={() => setCurrentQ(idx)}
              aria-label={`Question ${idx + 1}`}
            >
              {idx + 1}
            </QuestionDot>
          ))}
        </QuestionNav>
      </QuestionCard>

      {showExitModal && (
        <ModalOverlay onClick={cancelExit}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <h3>Leave this test?</h3>
            <p>Your answers haven't been saved yet. You'll lose your progress if you leave now.</p>
            <ModalActions>
              <ModalBtnSecondary onClick={cancelExit}>Stay</ModalBtnSecondary>
              <ModalBtnDanger onClick={confirmExit}>Leave</ModalBtnDanger>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {showModeModal && (
        <ModalOverlay onClick={cancelModeChange}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <h3>Switch mode?</h3>
            <p>This will clear your current answers so you can start fresh in the new mode.</p>
            <ModalActions>
              <ModalBtnSecondary onClick={cancelModeChange}>Cancel</ModalBtnSecondary>
              <ModalBtnPrimary onClick={confirmModeChange}>Switch & reset</ModalBtnPrimary>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}
    </Page>
  );
}

export default TestTaker;
