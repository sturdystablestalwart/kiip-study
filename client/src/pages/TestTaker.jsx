import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import QuestionRenderer from '../components/QuestionRenderer';
import { scoreQuestion } from '../utils/scoring';

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

const ReviewButton = styled.button`
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  background: ${({ theme }) => theme.colors.accent.moss};
  color: ${({ theme }) => theme.colors.bg.surface};
  border: none;
  cursor: pointer;
  margin-top: ${({ theme }) => theme.layout.space[4]}px;
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:hover { opacity: 0.9; }
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

  border: 1px solid ${({ $current, $answered, $correct, $missed, theme }) => {
    if ($current) return theme.colors.accent.indigo;
    if ($correct) return theme.colors.accent.moss;
    if ($missed) return theme.colors.state.danger;
    if ($answered) return theme.colors.accent.moss;
    return theme.colors.border.subtle;
  }};

  background: ${({ $current, $answered, $correct, $missed, theme }) => {
    if ($current) return theme.colors.accent.indigo;
    if ($correct) return theme.colors.state.correctBg;
    if ($missed) return theme.colors.state.wrongBg;
    if ($answered) return theme.colors.state.correctBg;
    return theme.colors.bg.surface;
  }};

  color: ${({ $current, $missed, theme }) => {
    if ($current) return theme.colors.bg.surface;
    if ($missed) return theme.colors.state.danger;
    return theme.colors.text.muted;
  }};

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

/* ── Flag UI ── */

const FlagButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  cursor: pointer;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.state.warning};
    border-color: ${({ theme }) => theme.colors.state.warning};
  }
`;

const FlagSelect = styled.select`
  width: 100%;
  height: ${({ theme }) => theme.layout.controlHeights.input}px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const FlagTextarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  resize: vertical;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const FlagSuccessMsg = styled.p`
  color: ${({ theme }) => theme.colors.state.success};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  text-align: center;
  margin: ${({ theme }) => theme.layout.space[4]}px 0;
`;

/* ── Export links ── */

const ExportRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  flex-wrap: wrap;
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
`;

const ExportLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[1]}px;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  text-decoration: none;
  background: ${({ theme }) => theme.colors.bg.surface};
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    color: ${({ theme }) => theme.colors.accent.indigo};
  }
`;

/* ───────── Component ───────── */

function TestTaker() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const [reviewMode, setReviewMode] = useState(false);

  const [sessionId, setSessionId] = useState(null);
  const [attemptId, setAttemptId] = useState(null);

  const { user } = useAuth();
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagNote, setFlagNote] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSuccess, setFlagSuccess] = useState(false);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const res = await api.get(`/api/tests/${id}`, {
          timeout: 10000
        });
        setTest(res.data);

        if (user) {
          try {
            const sessionRes = await api.post('/api/sessions/start', { testId: id, mode });
            const session = sessionRes.data.session;
            setSessionId(session._id);

            if (sessionRes.data.resumed && session.answers && session.answers.length > 0) {
              // Restore answers from session array format to object keyed by questionIndex
              const restoredAnswers = {};
              session.answers.forEach(ans => {
                restoredAnswers[ans.questionIndex] = {
                  selectedOptions: ans.selectedOptions || [],
                  textAnswer: ans.textAnswer || '',
                  orderedItems: ans.orderedItems || [],
                  blankAnswers: ans.blankAnswers || []
                };
              });
              setAnswers(restoredAnswers);
              if (session.currentQuestion != null) {
                setCurrentQ(session.currentQuestion);
              }
              if (session.remainingTime != null) {
                setTimeLeft(session.remainingTime);
              }
            }
          } catch (sessionErr) {
            console.error('Failed to start/resume session', sessionErr);
            // Non-fatal — continue without session
          }
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Could not load this test. It may have been removed or the server is unavailable.');
      }
    };
    fetchTest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Auto-save session progress every 30 seconds for authenticated users
  useEffect(() => {
    if (!sessionId || isSubmitted) return;
    const interval = setInterval(() => {
      const answerArray = Object.entries(answers).map(([idx, ans]) => ({
        questionIndex: parseInt(idx),
        selectedOptions: ans.selectedOptions || [],
        textAnswer: ans.textAnswer || '',
        orderedItems: ans.orderedItems || [],
        blankAnswers: ans.blankAnswers || []
      }));
      api.patch(`/api/sessions/${sessionId}`, {
        answers: answerArray,
        currentQuestion: currentQ,
        remainingTime: timeLeft
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [sessionId, answers, currentQ, timeLeft, isSubmitted]);

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

  // Keyboard shortcuts: 1-N select options (MCQ types), arrow keys navigate
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isSubmitted || showExitModal || showModeModal || showFlagModal) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!test) return;

      const question = test.questions[currentQ];
      if (!question) return;

      const qType = question.type || 'mcq-single';
      if ((qType === 'mcq-single' || qType === 'mcq-multiple' || qType === 'multiple-choice') && question.options) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= question.options.length) {
          e.preventDefault();
          if (qType === 'mcq-multiple') {
            // Toggle selection for multi-select
            const current = answers[currentQ]?.selectedOptions || [];
            const idx = num - 1;
            const newSelected = current.includes(idx)
              ? current.filter(i => i !== idx)
              : [...current, idx];
            setAnswers(prev => ({
              ...prev,
              [currentQ]: { selectedOptions: newSelected, overdue: timerExpired }
            }));
          } else {
            // Single select
            setAnswers(prev => ({
              ...prev,
              [currentQ]: { selectedOptions: [num - 1], overdue: timerExpired }
            }));
          }
          return;
        }
      }

      if (e.key === 'ArrowRight' && currentQ < test.questions.length - 1) {
        e.preventDefault();
        setCurrentQ(currentQ + 1);
      } else if (e.key === 'ArrowLeft' && currentQ > 0) {
        e.preventDefault();
        setCurrentQ(currentQ - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [test, currentQ, answers, isSubmitted, showExitModal, showModeModal, showFlagModal, timerExpired]);

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
      const isCorrect = ans ? scoreQuestion(q, ans) : false;
      if (isCorrect) correctCount++;
      return {
        questionIndex: idx,
        selectedOptions: ans?.selectedOptions,
        textAnswer: ans?.textAnswer,
        orderedItems: ans?.orderedItems,
        blankAnswers: ans?.blankAnswers,
        isCorrect,
        isOverdue: ans?.overdue ?? false
      };
    });

    setScore(correctCount);
    setIsSubmitted(true);

    if (sessionId) {
      // Authenticated user — save final state then submit via session endpoint
      try {
        const finalAnswerArray = submissionAnswers.map(ans => ({
          questionIndex: ans.questionIndex,
          selectedOptions: ans.selectedOptions || [],
          textAnswer: ans.textAnswer || '',
          orderedItems: ans.orderedItems || [],
          blankAnswers: ans.blankAnswers || []
        }));
        await api.patch(`/api/sessions/${sessionId}`, {
          answers: finalAnswerArray,
          currentQuestion: currentQ,
          remainingTime: timeLeft
        });
        const submitRes = await api.post(`/api/sessions/${sessionId}/submit`);
        if (submitRes.data.attempt?._id) {
          setAttemptId(submitRes.data.attempt._id);
        }
      } catch (err) {
        console.error('Failed to submit session', err);
      }
    } else {
      // Anonymous user — use legacy attempt endpoint
      try {
        await api.post(`/api/tests/${id}/attempt`, {
          score: correctCount,
          totalQuestions: test.questions.length,
          duration: (30 * 60) - timeLeft,
          overdueTime: overdueSeconds,
          answers: submissionAnswers,
          mode
        });
      } catch (err) {
        console.error('Failed to save attempt', err);
      }
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

  const handleFlagSubmit = async () => {
    if (!flagReason) return;
    setFlagSubmitting(true);
    try {
      await api.post('/api/flags', {
        testId: id,
        questionIndex: currentQ,
        reason: flagReason,
        note: flagNote
      });
      setFlagSuccess(true);
      setTimeout(() => {
        setShowFlagModal(false);
        setFlagSuccess(false);
        setFlagReason('');
        setFlagNote('');
      }, 1500);
    } catch (err) {
      console.error('Flag submit error:', err);
    } finally {
      setFlagSubmitting(false);
    }
  };

  // Error state
  if (error) {
    return (
      <ErrorScreen>
        <h2>{t('common.error')}</h2>
        <p>{error}</p>
        <NavButton $primary onClick={() => navigate('/')}>{t('test.goHome')}</NavButton>
      </ErrorScreen>
    );
  }

  // Loading state
  if (!test) {
    return <LoadingScreen>{t('common.loading')}</LoadingScreen>;
  }

  const missedIndices = (isSubmitted && test)
    ? test.questions.map((q, i) => {
        const ans = answers[i];
        return (!ans || !scoreQuestion(q, ans)) ? i : -1;
      }).filter(i => i >= 0)
    : [];

  // Review-mode navigation helpers
  const reviewPos = reviewMode ? missedIndices.indexOf(currentQ) : -1;
  const canGoPrev = reviewMode ? reviewPos > 0 : currentQ > 0;
  const canGoNext = reviewMode
    ? reviewPos < missedIndices.length - 1
    : currentQ < test.questions.length - 1;

  const goPrev = () => {
    if (reviewMode) {
      setCurrentQ(missedIndices[reviewPos - 1]);
    } else {
      setCurrentQ(Math.max(0, currentQ - 1));
    }
  };

  const goNext = () => {
    if (reviewMode) {
      setCurrentQ(missedIndices[reviewPos + 1]);
    } else {
      setCurrentQ(currentQ + 1);
    }
  };

  const currentQuestion = test.questions[currentQ];
  const currentAnswer = answers[currentQ];
  const showFeedback = mode === 'Practice' ? (currentAnswer !== undefined) : isSubmitted;
  const percentage = Math.round((score / test.questions.length) * 100);
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
              <option value="Test">{t('test.exam')}</option>
              <option value="Practice">{t('test.practice')}</option>
            </ModeSelect>
          </ModeRow>
        </HeaderLeft>
        <HeaderRight>
          <TimerDisplay $expired={timerExpired}>
            {timerExpired ? `+${formatTime(overdueSeconds)}` : formatTime(timeLeft)}
          </TimerDisplay>
          <ExitButton onClick={handleExitClick}>
            {t('test.goHome')}
          </ExitButton>
        </HeaderRight>
      </HeaderBar>

      {isSubmitted && (
        <ResultCard>
          <h2>{t('test.score')}: {score}/{test.questions.length}</h2>
          <ScorePercentage>{percentage}%</ScorePercentage>
          {overdueSeconds > 0 && (
            <OverdueNote>
              {t('test.overdue')}: +{formatTime(overdueSeconds)}
            </OverdueNote>
          )}
          <ExportRow>
            <ExportLink href={`${apiBaseUrl}/api/pdf/test/${id}?variant=blank`} target="_blank" rel="noopener">
              {t('test.exportBlank')}
            </ExportLink>
            <ExportLink href={`${apiBaseUrl}/api/pdf/test/${id}?variant=answerKey`} target="_blank" rel="noopener">
              {t('test.exportAnswerKey')}
            </ExportLink>
            {attemptId && (
              <>
                <ExportLink href={`${apiBaseUrl}/api/pdf/attempt/${attemptId}?variant=student`} target="_blank" rel="noopener">
                  {t('test.exportMyAnswers')}
                </ExportLink>
                <ExportLink href={`${apiBaseUrl}/api/pdf/attempt/${attemptId}?variant=report`} target="_blank" rel="noopener">
                  {t('test.exportReport')}
                </ExportLink>
              </>
            )}
          </ExportRow>
          {missedIndices.length > 0 && !reviewMode && (
            <ReviewButton onClick={() => { setReviewMode(true); setCurrentQ(missedIndices[0]); }}>
              {t('test.reviewMissed')} ({missedIndices.length})
            </ReviewButton>
          )}
          {reviewMode && (
            <ReviewButton onClick={() => setReviewMode(false)}>
              {t('test.results')}
            </ReviewButton>
          )}
          <BackToTestsButton onClick={() => navigate('/')}>
            {t('test.goHome')}
          </BackToTestsButton>
        </ResultCard>
      )}

      <QuestionCard>
        {currentQuestion.image && (
          <QuestionImage
            src={currentQuestion.image.startsWith('http') ? currentQuestion.image : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${currentQuestion.image}`}
            alt="Question visual"
          />
        )}
        <QuestionText>{currentQ + 1}. {currentQuestion.text}</QuestionText>
        <QuestionRenderer
          question={currentQuestion}
          answer={currentAnswer}
          onAnswer={(answerData) => {
            if (isSubmitted) return;
            setAnswers(prev => ({
              ...prev,
              [currentQ]: { ...answerData, overdue: timerExpired }
            }));
          }}
          showFeedback={showFeedback}
          disabled={isSubmitted}
        />

        {user && !reviewMode && (
          <FlagButton onClick={() => setShowFlagModal(true)}>
            &#9873; {t('test.flagQuestion')}
          </FlagButton>
        )}

        <Controls>
          <NavButton onClick={goPrev} disabled={!canGoPrev}>
            {t('test.previous')}
          </NavButton>
          {reviewMode ? (
            <NavButton $primary onClick={goNext} disabled={!canGoNext}>{t('test.next')}</NavButton>
          ) : canGoNext ? (
            <NavButton $primary onClick={goNext}>{t('test.next')}</NavButton>
          ) : (
            <SubmitButton onClick={handleSubmit} disabled={isSubmitted}>
              {t('test.submit')}
            </SubmitButton>
          )}
        </Controls>

        <QuestionNav>
          {(reviewMode ? missedIndices : test.questions.map((_, i) => i)).map((qIdx) => {
            const ans = answers[qIdx];
            const hasAnswer = ans !== undefined;
            const feedbackVisible = mode === 'Practice' ? hasAnswer : isSubmitted;
            const isCorrect = feedbackVisible && hasAnswer && scoreQuestion(test.questions[qIdx], ans);
            const isMissed = feedbackVisible && (!hasAnswer || !scoreQuestion(test.questions[qIdx], ans));
            return (
              <QuestionDot
                key={qIdx}
                $current={qIdx === currentQ}
                $answered={hasAnswer && !feedbackVisible}
                $correct={isCorrect}
                $missed={isMissed}
                onClick={() => setCurrentQ(qIdx)}
                aria-label={`Question ${qIdx + 1}`}
              >
                {qIdx + 1}
              </QuestionDot>
            );
          })}
        </QuestionNav>
      </QuestionCard>

      {showExitModal && (
        <ModalOverlay onClick={cancelExit}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <h3>{t('test.confirmExit')}</h3>
            <p></p>
            <ModalActions>
              <ModalBtnSecondary onClick={cancelExit}>{t('common.cancel')}</ModalBtnSecondary>
              <ModalBtnDanger onClick={confirmExit}>{t('common.confirm')}</ModalBtnDanger>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {showModeModal && (
        <ModalOverlay onClick={cancelModeChange}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <h3>{t('test.confirmModeSwitch')}</h3>
            <p></p>
            <ModalActions>
              <ModalBtnSecondary onClick={cancelModeChange}>{t('common.cancel')}</ModalBtnSecondary>
              <ModalBtnPrimary onClick={confirmModeChange}>{t('common.confirm')}</ModalBtnPrimary>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {showFlagModal && (
        <ModalOverlay onClick={() => setShowFlagModal(false)}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <h3>{t('flag.title')}</h3>
            {flagSuccess ? (
              <FlagSuccessMsg>{t('flag.success')}</FlagSuccessMsg>
            ) : (
              <>
                <FlagSelect
                  value={flagReason}
                  onChange={e => setFlagReason(e.target.value)}
                >
                  <option value="">{t('flag.reason')}...</option>
                  <option value="incorrect-answer">{t('flag.incorrectAnswer')}</option>
                  <option value="unclear-question">{t('flag.unclearQuestion')}</option>
                  <option value="typo">{t('flag.typo')}</option>
                  <option value="other">{t('flag.other')}</option>
                </FlagSelect>
                <FlagTextarea
                  placeholder={t('flag.note')}
                  value={flagNote}
                  onChange={e => setFlagNote(e.target.value)}
                  maxLength={500}
                />
                <ModalActions>
                  <ModalBtnSecondary onClick={() => setShowFlagModal(false)}>
                    {t('common.cancel')}
                  </ModalBtnSecondary>
                  <ModalBtnPrimary
                    onClick={handleFlagSubmit}
                    disabled={!flagReason || flagSubmitting}
                  >
                    {flagSubmitting ? t('common.loading') : t('flag.submit')}
                  </ModalBtnPrimary>
                </ModalActions>
              </>
            )}
          </ModalCard>
        </ModalOverlay>
      )}
    </Page>
  );
}

export default TestTaker;
