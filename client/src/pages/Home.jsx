import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSearchPalette } from '../context/SearchPaletteContext';
import { below } from '../theme/breakpoints';
import FilterDropdown from '../components/FilterDropdown';
import { Button, Card as UiCard, Badge, Modal, ModalActions, EmptyState } from '../components/ui';

/* ───────── Styled Components ───────── */

const PageHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.layout.space[7]}px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[4]}px;

  h1 {
    margin: 0;
  }
`;


const SearchTrigger = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${({ theme }) => theme.layout.controlHeights.input}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              box-shadow ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.focus.ring};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focus.shadow};
  }
`;

const SearchHintSpan = styled.span`
  margin-left: auto;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: 2px ${({ theme }) => theme.layout.space[2]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};

  ${below.mobile} {
    display: none;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.layout.space[5]}px;

  ${below.mobile} {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.layout.space[3]}px;
  }
`;


const CardTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.layout.space[2]}px 0;
  padding-right: ${({ theme }) => theme.layout.space[7]}px;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const CardMeta = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  line-height: ${({ theme }) => theme.typography.scale.small.line}px;
  margin: 0;
`;

const CardScore = styled.div`
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  line-height: ${({ theme }) => theme.typography.scale.micro.line}px;
  color: ${({ theme }) => theme.colors.accent.moss};
`;

const CardNoAttempt = styled.div`
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
`;

const DeleteButton = styled.button`
  position: absolute;
  top: ${({ theme }) => theme.layout.space[2]}px;
  right: ${({ theme }) => theme.layout.space[2]}px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.state.danger};
    background: ${({ theme }) => theme.colors.state.wrongBg};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus.ring};
    outline-offset: 2px;
  }
`;

const EditButton = styled.button`
  position: absolute;
  top: ${({ theme }) => theme.layout.space[2]}px;
  right: ${({ theme }) => theme.layout.space[8]}px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.accent.indigo};
    background: ${({ theme }) => theme.colors.selection.bg};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus.ring};
    outline-offset: 2px;
  }
`;

const ExportLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[1]}px;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.muted};
  background: ${({ theme }) => theme.colors.bg.surface};
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    color: ${({ theme }) => theme.colors.accent.indigo};
  }
`;

const ShareButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[1]}px;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  background: ${({ theme }) => theme.colors.bg.surface};
  cursor: pointer;
  font-family: inherit;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    color: ${({ theme }) => theme.colors.accent.indigo};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CardActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
`;

const CopiedToast = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.state.success};
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
`;


const ErrorBanner = styled.div`
  background: ${({ theme }) => theme.colors.state.wrongBg};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  color: ${({ theme }) => theme.colors.state.danger};
  padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
`;


const LoadingState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;


const DashboardSection = styled.section`
  margin-bottom: ${({ theme }) => theme.layout.space[7]}px;
`;

const SectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.layout.space[4]}px 0;
`;

const ContinueCard = styled(Link)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[5]}px ${({ theme }) => theme.layout.space[6]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.accent.indigo}33;
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
  text-decoration: none;
  color: inherit;
  transition: transform ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease},
              box-shadow ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.layout.shadow.md};
  }
`;

const ContinueInfo = styled.div`
  flex: 1;
`;

const ContinueTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.layout.space[1]}px 0;
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;

const ContinueMeta = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
`;

const ContinueScore = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.accent.moss};
`;

const RecentRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  overflow-x: auto;
  padding-bottom: ${({ theme }) => theme.layout.space[2]}px;
`;

const RecentChip = styled(Link)`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  text-decoration: none;
  color: inherit;
  transition: transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    transform: translateY(-2px);
  }
`;

const RecentScore = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.accent.moss};
`;

const RecentLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin-top: ${({ theme }) => theme.layout.space[1]}px;
`;

const EndlessCard = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[5]}px;
  padding: ${({ theme }) => theme.layout.space[5]}px ${({ theme }) => theme.layout.space[6]}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
  text-decoration: none;
  color: inherit;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              box-shadow ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.moss};
    box-shadow: ${({ theme }) => theme.layout.shadow.md};
  }
`;

const EndlessIcon = styled.span`
  font-size: 32px;
  color: ${({ theme }) => theme.colors.accent.moss};
  line-height: 1;
`;

const EndlessInfo = styled.div`
  flex: 1;
`;

const EndlessTitle = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.layout.space[1]}px;
`;

const EndlessMeta = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const SessionSection = styled.div`
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const SessionSectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
`;

const SessionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.layout.space[3]}px;

  ${below.mobile} {
    grid-template-columns: 1fr;
  }
`;

const SessionCard = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  padding: ${({ theme }) => theme.layout.space[4]}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.accent.indigo}33;
  border-left: 3px solid ${({ theme }) => theme.colors.accent.indigo};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  text-decoration: none;
  color: ${({ theme }) => theme.colors.text.primary};
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    box-shadow: ${({ theme }) => theme.layout.shadow.md};
  }
`;

const SessionInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SessionTitle = styled.p`
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
`;

const SessionMeta = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin: ${({ theme }) => theme.layout.space[1]}px 0 0 0;
`;


const PulsingDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.state.success};
  margin-right: ${({ theme }) => theme.layout.space[2]}px;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  animation: pulse 2s infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const DifficultyBadge = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  background: ${({ $score, theme }) =>
    $score >= 80 ? theme.colors.state.correctBg :
    $score >= 50 ? theme.colors.state.infoBg :
    theme.colors.state.wrongBg};
  color: ${({ $score, theme }) =>
    $score >= 80 ? theme.colors.state.success :
    $score >= 50 ? theme.colors.state.warning :
    theme.colors.state.danger};
`;

const OnboardingCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  padding: ${({ theme }) => theme.layout.space[6]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
`;

const OnboardingTitle = styled.h2`
  margin: 0 0 ${({ theme }) => theme.layout.space[3]}px 0;
`;

const OnboardingText = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  margin: 0 0 ${({ theme }) => theme.layout.space[4]}px 0;
`;

const OnboardingHints = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
`;

const Hint = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const DismissBtn = styled.button`
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.accent.clay};
  background: transparent;
  color: ${({ theme }) => theme.colors.accent.clay};
  font-family: inherit;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  cursor: pointer;
  min-height: ${({ theme }) => theme.layout.controlHeights.button}px;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.accent.clay};
    color: ${({ theme }) => theme.colors.bg.surface};
  }
`;

const FilterBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[3]}px;

  ${below.mobile} {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  align-items: center;
`;

const TestCount = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
`;


const BadgeRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.layout.space[2]}px;
`;

/* ───────── Component ───────── */

function Home() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchPalette = useSearchPalette();
  const isAdmin = user?.isAdmin;
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [total, setTotal] = useState(0);
  const [levelFilter, setLevelFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [curriculum, setCurriculum] = useState([]);
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [difficultyMap, setDifficultyMap] = useState({});
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('kiip_onboarded')
  );
  const [deleteModal, setDeleteModal] = useState({ show: false, testId: null, testTitle: '' });
  const [deleting, setDeleting] = useState(false);
  const [copiedTestId, setCopiedTestId] = useState(null);
  const [sharingTestId, setSharingTestId] = useState(null);

  useEffect(() => {
    api.get('/api/curriculum').then(res => setCurriculum(res.data)).catch(() => {});
  }, []);

  useEffect(() => { setUnitFilter(''); }, [levelFilter]);

  const levelOptions = curriculum.map(c => ({ value: c.level, label: c.levelName.ko }));
  const unitOptions = levelFilter
    ? (curriculum.find(c => c.level === levelFilter)?.units || [])
        .filter(u => !u.isReview)
        .map(u => ({ value: String(u.number), label: `${u.number}과 — ${u.titleKo}` }))
    : [];
  const CONTENT_TYPE_OPTIONS = [
    { value: 'mock-exam', label: t('classification.mockExam') },
    { value: 'topic-drill', label: t('classification.topicDrill') },
    { value: 'vocabulary', label: t('classification.vocabulary') },
    { value: 'grammar', label: t('classification.grammar') },
  ];

  const fetchTests = useCallback(async (cursor = null, append = false, signal) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (levelFilter) params.set('level', levelFilter);
      if (unitFilter) params.set('unit', unitFilter);
      if (contentTypeFilter) params.set('contentType', contentTypeFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '20');

      const res = await api.get(`/api/tests?${params}`, {
        timeout: 10000, signal
      });

      if (append) {
        setTests(prev => [...prev, ...res.data.tests]);
      } else {
        setTests(res.data.tests);
      }
      setNextCursor(res.data.nextCursor);
      setTotal(res.data.total);
    } catch (err) {
      if (err.name === 'CanceledError') return;
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Could not reach the server');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [levelFilter, unitFilter, contentTypeFilter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTests(null, false, controller.signal);
    return () => controller.abort();
  }, [fetchTests]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();

    // Fetch recent attempts, active sessions, and difficulty data in parallel
    Promise.all([
      api.get('/api/tests/recent-attempts?limit=5', { timeout: 10000, signal: controller.signal }),
      api.get('/api/sessions/active', { signal: controller.signal }),
      api.get('/api/review/difficulty', { signal: controller.signal })
    ]).then(([recentRes, sessionsRes, diffRes]) => {
      setRecentAttempts(recentRes.data);
      setActiveSessions((sessionsRes.data.sessions || []).filter(s => s.testId));
      setDifficultyMap(diffRes.data.difficulty || {});
    }).catch(err => {
      if (err.name === 'CanceledError') return;
      console.error('Failed to fetch user data:', err);
    });

    return () => controller.abort();
  }, [user]);

  const handleLoadMore = () => {
    if (nextCursor) {
      fetchTests(nextCursor, true);
    }
  };

  const handleDeleteClick = (e, testId, testTitle) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteModal({ show: true, testId, testTitle });
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/admin/tests/${deleteModal.testId}`);
      setTests(prev => prev.filter(t => t._id !== deleteModal.testId));
      setDeleteModal({ show: false, testId: null, testTitle: '' });
    } catch (err) {
      console.error(err);
      alert('Could not delete this test. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ show: false, testId: null, testTitle: '' });
  };

  const handleShare = async (e, testId) => {
    e.preventDefault();
    e.stopPropagation();
    setSharingTestId(testId);
    try {
      const res = await api.post(`/api/tests/${testId}/share`);
      await navigator.clipboard.writeText(res.data.shareUrl);
      setCopiedTestId(testId);
      setTimeout(() => setCopiedTestId(null), 2000);
    } catch (err) {
      console.error('Failed to share test:', err);
    } finally {
      setSharingTestId(null);
    }
  };

  const lastAttempt = recentAttempts[0];
  const scorePercent = lastAttempt
    ? Math.round((lastAttempt.score / lastAttempt.totalQuestions) * 100)
    : 0;

  const dismissOnboarding = () => {
    localStorage.setItem('kiip_onboarded', '1');
    setShowOnboarding(false);
  };

  return (
    <div>
      <PageHeader>
        <h1>{t('home.title')}</h1>
        {isAdmin && <Button as={Link} to="/create" $variant="primary">+ {t('nav.create')}</Button>}
      </PageHeader>

      {showOnboarding && (
        <OnboardingCard data-testid="onboarding-card">
          <OnboardingTitle>{t('onboarding.welcome')}</OnboardingTitle>
          <OnboardingText>{t('onboarding.description')}</OnboardingText>
          <OnboardingHints>
            <Hint>{t('onboarding.hintKeyboard')}</Hint>
            <Hint>{t('onboarding.hintSearch')}</Hint>
            <Hint>{t('onboarding.hintEndless')}</Hint>
          </OnboardingHints>
          <DismissBtn onClick={dismissOnboarding}>{t('onboarding.dismiss')}</DismissBtn>
        </OnboardingCard>
      )}

      <SearchTrigger onClick={() => searchPalette?.openPalette()} aria-label={t('nav.search')}>
        {t('nav.search')}
        <SearchHintSpan>Ctrl+P</SearchHintSpan>
      </SearchTrigger>

      {error && (
        <ErrorBanner>
          <span>{error}</span>
          <Button $variant="danger" $size="compact" onClick={() => fetchTests()}>{t('common.retry')}</Button>
        </ErrorBanner>
      )}

      {activeSessions.length > 0 && (
        <SessionSection data-testid="active-sessions">
          <SessionSectionTitle>{t('home.continueSession')}</SessionSectionTitle>
          <SessionGrid>
            {activeSessions.map(session => {
              const mins = Math.floor(session.remainingTime / 60);
              const secs = session.remainingTime % 60;
              return (
                <SessionCard key={session._id} to={`/test/${session.testId._id || session.testId}`}>
                  <SessionInfo>
                    <SessionTitle>{session.testId.title || 'Test'}</SessionTitle>
                    <SessionMeta>
                      {session.mode} mode &mdash; {mins}:{String(secs).padStart(2, '0')} remaining
                    </SessionMeta>
                  </SessionInfo>
                  <Badge $color="indigo"><PulsingDot />Continue</Badge>
                </SessionCard>
              );
            })}
          </SessionGrid>
        </SessionSection>
      )}

      {lastAttempt && (
        <DashboardSection>
          <ContinueCard to={`/test/${lastAttempt.testId}`}>
            <ContinueInfo>
              <ContinueTitle>{lastAttempt.test?.title || 'Test'}</ContinueTitle>
              <ContinueMeta>
                {lastAttempt.mode} mode &middot; {lastAttempt.score}/{lastAttempt.totalQuestions}
                {' '}&middot; {new Date(lastAttempt.createdAt).toLocaleDateString()}
              </ContinueMeta>
            </ContinueInfo>
            <ContinueScore>{scorePercent}%</ContinueScore>
          </ContinueCard>
        </DashboardSection>
      )}

      {recentAttempts.length > 1 && (
        <DashboardSection>
          <SectionTitle>{t('home.recentAttempts')}</SectionTitle>
          <RecentRow>
            {recentAttempts.map((attempt, i) => (
              <RecentChip key={attempt._id || i} to={`/test/${attempt.testId}`}>
                <RecentScore>
                  {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
                </RecentScore>
                <RecentLabel>
                  {attempt.test?.unit || attempt.test?.title?.slice(0, 8) || '...'}
                </RecentLabel>
              </RecentChip>
            ))}
          </RecentRow>
        </DashboardSection>
      )}

      <DashboardSection>
        <EndlessCard to="/endless">
          <EndlessIcon>&#x221E;</EndlessIcon>
          <EndlessInfo>
            <EndlessTitle>{t('home.endlessPractice')}</EndlessTitle>
            <EndlessMeta>{t('home.endlessDesc')}</EndlessMeta>
          </EndlessInfo>
        </EndlessCard>
      </DashboardSection>

      <FilterBar>
        <SectionTitle style={{ margin: 0 }}>{t('home.allTests')}</SectionTitle>
        <FilterGroup>
          <FilterDropdown
            label={t('home.level')}
            value={levelFilter}
            options={levelOptions}
            onChange={setLevelFilter}
          />
          {unitOptions.length > 0 && (
            <FilterDropdown
              label={t('home.unit')}
              value={unitFilter}
              options={unitOptions}
              onChange={setUnitFilter}
            />
          )}
          <FilterDropdown
            label={t('classification.contentType')}
            value={contentTypeFilter}
            options={CONTENT_TYPE_OPTIONS}
            onChange={setContentTypeFilter}
          />
          {total > 0 && <TestCount>{t('home.showing', { count: total })}</TestCount>}
        </FilterGroup>
      </FilterBar>

      {!loading && !error && tests.length === 0 && (
        <EmptyState
          icon="📋"
          title={t('home.noTests')}
          description={levelFilter || unitFilter ? t('common.retry') : t('home.createFirst')}
        >
          {isAdmin && !levelFilter && !unitFilter && (
            <Button as={Link} to="/create" $variant="primary">{t('home.createFirst')}</Button>
          )}
        </EmptyState>
      )}

      {tests.length > 0 && (
        <Grid>
          {tests.map(test => (
            <UiCard key={test._id} as={Link} to={`/test/${test._id}`} $interactive $padding="lg" style={{ position: 'relative', textDecoration: 'none', color: 'inherit' }}>
              {isAdmin && (
                <EditButton
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/admin/tests/${test._id}/edit`); }}
                  aria-label={`Edit ${test.title}`}
                >
                  &#9998;
                </EditButton>
              )}
              {isAdmin && (
                <DeleteButton
                  onClick={(e) => handleDeleteClick(e, test._id, test.title)}
                  aria-label={`Delete ${test.title}`}
                >
                  &times;
                </DeleteButton>
              )}
              <BadgeRow>
                {test.level && (
                  <Badge $color="indigo" $bold>
                    {curriculum.find(c => c.level === test.level)?.levelName?.ko || test.level}
                    {test.unitNumber != null && ` · ${test.unitNumber}과`}
                  </Badge>
                )}
                {test.contentType && test.contentType !== 'general' && (
                  <Badge $color="moss" $bold>{t(`classification.${test.contentType.replace('-', '')}`)}</Badge>
                )}
              </BadgeRow>
              <CardTitle>{test.title}</CardTitle>
              <CardMeta>{t('home.questionsCount', { count: test.questionCount })}</CardMeta>
              {difficultyMap[test._id] && (
                <DifficultyBadge $score={difficultyMap[test._id].avgScore}>
                  {difficultyMap[test._id].avgScore >= 80 ? 'Easy' :
                   difficultyMap[test._id].avgScore >= 50 ? 'Medium' : 'Hard'}
                </DifficultyBadge>
              )}
              {test.lastAttempt ? (
                <CardScore>
                  {t('home.lastScore', { score: Math.round((test.lastAttempt.score / test.lastAttempt.totalQuestions) * 100) })}
                  {' '}({new Date(test.lastAttempt.createdAt).toLocaleDateString()})
                </CardScore>
              ) : (
                <CardNoAttempt>{t('home.notAttempted')}</CardNoAttempt>
              )}
              <CardActions>
                {user && (
                  <>
                    <ShareButton
                      onClick={(e) => handleShare(e, test._id)}
                      disabled={sharingTestId === test._id}
                      title={t('home.share')}
                    >
                      {copiedTestId === test._id ? (
                        <CopiedToast>{t('home.linkCopied')}</CopiedToast>
                      ) : (
                        <>&#128279; {t('home.share')}</>
                      )}
                    </ShareButton>
                    <ExportLink
                      title={t('home.downloadPdf')}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`${apiBaseUrl}/api/pdf/test/${test._id}?variant=blank`, '_blank', 'noopener'); }}
                    >
                      PDF
                    </ExportLink>
                  </>
                )}
              </CardActions>
            </UiCard>
          ))}
        </Grid>
      )}

      {nextCursor && (
        <Button
          $variant="secondary"
          onClick={handleLoadMore}
          disabled={loadingMore}
          style={{ width: '100%', maxWidth: 300, margin: 'auto', display: 'flex' }}
        >
          {loadingMore ? t('common.loading') : t('home.loadMore')}
        </Button>
      )}

      {deleteModal.show && (
        <Modal onClose={cancelDelete} ariaLabel="Delete confirmation">
          <h3 style={{ margin: '0 0 12px 0' }}>Remove this test?</h3>
          <p style={{ color: 'inherit', marginBottom: 0 }}>
            &ldquo;{deleteModal.testTitle}&rdquo; and its attempt history will be permanently removed.
          </p>
          <ModalActions>
            <Button $variant="secondary" onClick={cancelDelete}>Keep it</Button>
            <Button $variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Removing...' : 'Remove'}
            </Button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
}

export default Home;
