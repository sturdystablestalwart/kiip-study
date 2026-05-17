import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { below } from '../theme/breakpoints';
import QuestionRenderer from '../components/QuestionRenderer';
import { scoreQuestion } from '../utils/scoring';
import { saveAnonymousAttempt } from '../utils/anonymousAttempts';
import { Button, Card, Modal, ModalActions } from '../components/ui';

/* ───────── Styled Components ───────── */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[6]}px;
`;

/* ── Header ── */

const HeaderBar = styled(Card)`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${({ theme }) => theme.layout.space[4]}px;
  flex-wrap: wrap;

  ${below.mobile} {
    padding: ${({ theme }) => theme.layout.space[4]}px;
  }
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

/* ── Result card ── */

const ResultCard = styled(Card)`
  text-align: center;

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

const QuestionCard = styled(Card)`
  ${below.tablet} {
    padding: ${({ theme }) => theme.layout.space[5]}px;
  }
  ${below.mobile} {
    padding-bottom: 80px;
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

  ${below.mobile} {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    margin-top: 0;
    padding: ${({ theme }) => theme.layout.space[3]}px;
    background: ${({ theme }) => theme.colors.bg.surface};
    border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
    z-index: ${({ theme }) => theme.zIndex.dropdown};
  }
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


const BackToTestsButton = styled(Button)`
  margin-top: ${({ theme }) => theme.layout.space[5]}px;
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

/* ── Modal inner styles ── */

const ModalBody = styled.div`
  text-align: center;

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
  padding: 0 ${({ theme }) => theme.layout.space[7]}px 0 ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background-color: ${({ theme }) => theme.colors.bg.surface};
  background-image: url("/chevron-down.svg");
  background-repeat: no-repeat;
  background-position: right 12px center;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              box-shadow ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focus.shadow};
  }
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
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              box-shadow ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.faint};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focus.shadow};
  }
`;

const FlagSuccessMsg = styled.p`
  color: ${({ theme }) => theme.colors.state.success};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  text-align: center;
  margin: ${({ theme }) => theme.layout.space[4]}px 0;
`;

/* ── Save indicator ── */

const SaveIndicator = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ $status, theme }) => {
    if ($status === 'saving') return theme.colors.text.faint;
    if ($status === 'saved') return theme.colors.state.success;
    if ($status === 'error') return theme.colors.state.warning;
    return 'transparent';
  }};
  transition: color ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease};
`;

/* ── Progress bar ── */

const ProgressContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const ProgressBarTrack = styled.div`
  flex: 1;
  height: 4px;
  background: ${({ theme }) => theme.colors.border.subtle};
  border-radius: 2px;
  overflow: hidden;
`;

const ProgressBarFill = styled.div`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: ${({ theme }) => theme.colors.accent.indigo};
  transition: width ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease};
  border-radius: 2px;
`;

const ProgressText = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  white-space: nowrap;
`;

/* ── Keyboard shortcut hint ── */

const Kbd = styled.kbd`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  padding: 1px 5px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: 4px;
  margin-left: ${({ theme }) => theme.layout.space[2]}px;
  opacity: 0.6;
  font-family: inherit;

  ${below.tablet} { display: none; }
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
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagNote, setFlagNote] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSuccess, setFlagSuccess] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTest = async () => {
      try {
        const res = await api.get(`/api/tests/${id}`, {
          timeout: 10000, signal: controller.signal
        });
        setTest(res.data);
      } catch (err) {
        if (err.name === 'CanceledError') return;
        if (!err.response || err.response.status >= 500) {
          console.error(err);
        }
        setError(err.response?.status === 404 ? t('common.notFound', 'Test not found') : t('common.error'));
      }
    };
    fetchTest();
    return () => controller.abort();
    // Issue #41 — `t` is the only other identifier the body reads, and
    // it's a stable reference returned by useTranslation (i18next swaps
    // the underlying language without changing the function identity).
    // Declaring it here drops the eslint-disable without re-triggering
    // the fetch on every render.
  }, [id, t]);

  // Session start (issue #114): separated from the test-fetch effect so that
  // a cold-load with a still-resolving AuthContext (`user` initially null)
  // doesn't permanently skip the session POST. Re-runs the moment `user`
  // populates; the `sessionId` guard makes it a one-shot per session.
  useEffect(() => {
    if (!user || sessionId || isSubmitted) return;
    const controller = new AbortController();
    const startSession = async () => {
      try {
        const sessionRes = await api.post('/api/sessions/start', { testId: id, mode }, {
          signal: controller.signal
        });
        const session = sessionRes.data.session;
        setSessionId(session._id);

        if (sessionRes.data.resumed && session.answers && session.answers.length > 0) {
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
          if (session.currentQuestion != null) setCurrentQ(session.currentQuestion);
          if (session.remainingTime != null) setTimeLeft(session.remainingTime);
        }
      } catch (sessionErr) {
        if (sessionErr.name === 'CanceledError') return;
        console.error('Failed to start/resume session', sessionErr);
      }
    };
    startSession();
    return () => controller.abort();
  }, [user, sessionId, isSubmitted, id, mode]);

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
  const autoSaveFailCount = useRef(0);
  const flagCloseTimerRef = useRef(null);

  const closeFlagModal = useCallback(() => {
    if (flagCloseTimerRef.current) {
      clearTimeout(flagCloseTimerRef.current);
      flagCloseTimerRef.current = null;
    }
    setShowFlagModal(false);
    setFlagSuccess(false);
    setFlagReason('');
    setFlagNote('');
  }, []);

  useEffect(() => () => {
    if (flagCloseTimerRef.current) clearTimeout(flagCloseTimerRef.current);
  }, []);
  // Issue #72 — the previous dep array
  //   [sessionId, answers, currentQ, timeLeft, isSubmitted]
  // tore down + recreated the 30s setInterval on every keystroke and
  // every 1s timer tick.  Each interval fired at most once before being
  // cleaned up — auto-save reliability was effectively random.
  //
  // Decouple the interval from the changing state via a ref so the
  // effect only re-runs when the *interval lifecycle* actually changes
  // (sessionId / isSubmitted), and the interval callback reads the
  // latest snapshot via the ref.
  const autoSaveLatest = useRef({ answers, currentQ, timeLeft });
  useEffect(() => {
    autoSaveLatest.current = { answers, currentQ, timeLeft };
  });

  useEffect(() => {
    if (!sessionId || isSubmitted) return;
    const controller = new AbortController();
    const interval = setInterval(() => {
      const snap = autoSaveLatest.current;
      const answerArray = Object.entries(snap.answers).map(([idx, ans]) => ({
        questionIndex: parseInt(idx),
        selectedOptions: ans.selectedOptions || [],
        textAnswer: ans.textAnswer || '',
        orderedItems: ans.orderedItems || [],
        blankAnswers: ans.blankAnswers || []
      }));
      setSaveStatus('saving');
      api.patch(`/api/sessions/${sessionId}`, {
        answers: answerArray,
        currentQuestion: snap.currentQ,
        remainingTime: snap.timeLeft
      }, { signal: controller.signal }).then(() => {
        autoSaveFailCount.current = 0;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }).catch(err => {
        if (err.name === 'CanceledError') return;
        autoSaveFailCount.current++;
        setSaveStatus('error');
        if (autoSaveFailCount.current >= 3) {
          console.warn('Auto-save failed repeatedly — progress may not be saved');
        }
      });
    }, 30000);
    return () => { clearInterval(interval); controller.abort(); };
  }, [sessionId, isSubmitted]);

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

  // Keyboard shortcuts: 1-N select options (MCQ types), arrow keys navigate.
  // Issue #155 — arrow-key nav has to work in review mode too: the UI
  // shows <Kbd>←</Kbd> / <Kbd>→</Kbd> hints after submit, but the
  // previous early-return on `isSubmitted` killed all key handling.
  // We now allow ArrowLeft / ArrowRight when `isSubmitted && reviewMode`
  // and route through the review-aware navigation.  Option-selection
  // keys stay gated on !isSubmitted.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showExitModal || showModeModal || showFlagModal) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!test) return;

      // Issue #155 — review-mode arrow nav after submission.  Compute
      // missedIndices inline (the outer const is declared later in the
      // component and would TDZ-trip the dep array).
      if (isSubmitted && reviewMode && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const missed = test.questions
          .map((q, i) => (!answers[i] || !scoreQuestion(q, answers[i])) ? i : -1)
          .filter((i) => i >= 0);
        const reviewPos = missed.indexOf(currentQ);
        if (e.key === 'ArrowLeft' && reviewPos > 0) {
          e.preventDefault();
          setCurrentQ(missed[reviewPos - 1]);
        } else if (e.key === 'ArrowRight' && reviewPos < missed.length - 1) {
          e.preventDefault();
          setCurrentQ(missed[reviewPos + 1]);
        }
        return;
      }

      if (isSubmitted) return;

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
  }, [test, currentQ, answers, isSubmitted, reviewMode, showExitModal, showModeModal, showFlagModal, timerExpired]);

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
      // No active session — save to localStorage for anonymous, or direct API for authenticated
      const attemptData = {
        testId: id,
        score: correctCount,
        totalQuestions: test.questions.length,
        duration: (30 * 60) - timeLeft,
        overdueTime: overdueSeconds,
        answers: submissionAnswers,
        mode
      };

      if (user) {
        try {
          await api.post(`/api/tests/${id}/attempt`, attemptData);
        } catch (err) {
          console.error('Failed to save attempt', err);
        }
      } else {
        saveAnonymousAttempt(attemptData);
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
      if (flagCloseTimerRef.current) clearTimeout(flagCloseTimerRef.current);
      flagCloseTimerRef.current = setTimeout(() => {
        flagCloseTimerRef.current = null;
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

  const answeredCount = test ? Object.keys(answers).filter(k => {
    const a = answers[k];
    return a && (a.selectedOptions?.length > 0 || a.textAnswer?.trim() || a.orderedItems?.length > 0 || a.blankAnswers?.some(b => b?.trim()));
  }).length : 0;
  const percentage = test.questions.length > 0
    ? Math.round((score / test.questions.length) * 100)
    : 0;
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  return (
    <Page>
      <HeaderBar>
        <HeaderLeft>
          <TestTitle>{test.title}</TestTitle>
          <ModeRow>
            <ModeLabel>{t('test.mode')}:</ModeLabel>
            <ModeSelect
              value={mode}
              onChange={(e) => handleModeChange(e.target.value)}
              disabled={isSubmitted}
              aria-label="Test mode"
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
          <SaveIndicator $status={saveStatus} data-testid="save-indicator">
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && 'Save failed'}
          </SaveIndicator>
          <Button $variant="secondary" $size="compact" onClick={handleExitClick}>
            {t('test.goHome')}
          </Button>
        </HeaderRight>
      </HeaderBar>

      {!isSubmitted && test && (
        <ProgressContainer data-testid="progress-bar">
          <ProgressBarTrack>
            <ProgressBarFill $percent={test.questions.length > 0 ? (answeredCount / test.questions.length) * 100 : 0} />
          </ProgressBarTrack>
          <ProgressText>{answeredCount} / {test.questions.length}</ProgressText>
        </ProgressContainer>
      )}

      {isSubmitted && (
        <ResultCard $padding="lg" $radius="lg" $shadow="md">
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

      <QuestionCard $padding="lg" $radius="lg">
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
            {t('test.previous')} <Kbd>←</Kbd>
          </NavButton>
          {reviewMode ? (
            <NavButton $primary onClick={goNext} disabled={!canGoNext}>{t('test.next')} <Kbd>→</Kbd></NavButton>
          ) : (
            <>
              {canGoNext && (
                <NavButton $primary onClick={goNext}>{t('test.next')} <Kbd>→</Kbd></NavButton>
              )}
              <Button onClick={handleSubmit} disabled={isSubmitted}>
                {t('test.submit')}
              </Button>
            </>
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
        <Modal onClose={cancelExit} ariaLabel={t('test.confirmExit')}>
          <ModalBody>
            <h3>{t('test.confirmExit')}</h3>
            <p>{t('test.confirmExitBody')}</p>
          </ModalBody>
          <ModalActions>
            <Button $variant="secondary" onClick={cancelExit}>{t('common.cancel')}</Button>
            <Button $variant="danger" onClick={confirmExit}>{t('common.confirm')}</Button>
          </ModalActions>
        </Modal>
      )}

      {showModeModal && (
        <Modal onClose={cancelModeChange} ariaLabel={t('test.confirmModeSwitch')}>
          <ModalBody>
            <h3>{t('test.confirmModeSwitch')}</h3>
            <p>{t('test.confirmModeSwitchBody')}</p>
          </ModalBody>
          <ModalActions>
            <Button $variant="secondary" onClick={cancelModeChange}>{t('common.cancel')}</Button>
            <Button $variant="accent" onClick={confirmModeChange}>{t('common.confirm')}</Button>
          </ModalActions>
        </Modal>
      )}

      {showFlagModal && (
        <Modal onClose={closeFlagModal} ariaLabel={t('flag.title')}>
          <ModalBody>
            <h3>{t('flag.title')}</h3>
          </ModalBody>
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
                <Button $variant="secondary" onClick={closeFlagModal}>
                  {t('common.cancel')}
                </Button>
                <Button
                  $variant="accent"
                  onClick={handleFlagSubmit}
                  disabled={!flagReason || flagSubmitting}
                >
                  {flagSubmitting ? t('common.loading') : t('flag.submit')}
                </Button>
              </ModalActions>
            </>
          )}
        </Modal>
      )}
    </Page>
  );
}

export default TestTaker;
