import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import FilterDropdown from '../components/FilterDropdown';

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

const CreateButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.accent.clay};
  color: ${({ theme }) => theme.colors.bg.surface};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  text-decoration: none;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: #8B5340;
    color: ${({ theme }) => theme.colors.bg.surface};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.layout.space[5]}px;
`;

const Card = styled(Link)`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[6]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
  text-decoration: none;
  color: inherit;
  position: relative;
  transition: transform ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease},
              box-shadow ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    transform: translateY(-3px);
    box-shadow: ${({ theme }) => theme.layout.shadow.md};
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
  top: ${({ theme }) => theme.layout.space[3]}px;
  right: ${({ theme }) => theme.layout.space[3]}px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: 1.1rem;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.state.danger};
    background: ${({ theme }) => theme.colors.state.wrongBg};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};

  h2 {
    color: ${({ theme }) => theme.colors.text.muted};
    font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
    margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
  }

  p {
    color: ${({ theme }) => theme.colors.text.faint};
    margin: 0 auto ${({ theme }) => theme.layout.space[5]}px;
  }
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

const RetryButton = styled.button`
  background: ${({ theme }) => theme.colors.state.danger};
  color: ${({ theme }) => theme.colors.bg.surface};
  border: none;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    opacity: 0.9;
  }
`;

const LoadingState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;

/* ── Modal ── */

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

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ModalBtnCancel = styled(ModalBtn)`
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const ModalBtnDanger = styled(ModalBtn)`
  background: ${({ theme }) => theme.colors.state.danger};
  color: ${({ theme }) => theme.colors.bg.surface};
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
  margin-top: 2px;
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

const FilterBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[3]}px;
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

const LoadMoreButton = styled.button`
  display: block;
  width: 100%;
  max-width: 300px;
  margin: ${({ theme }) => theme.layout.space[6]}px auto 0;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.border.subtle};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/* ───────── Component ───────── */

function Home() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [total, setTotal] = useState(0);
  const [levelFilter, setLevelFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ show: false, testId: null, testTitle: '' });
  const [deleting, setDeleting] = useState(false);

  const fetchTests = useCallback(async (cursor = null, append = false) => {
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
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '20');

      const res = await axios.get(`${API_BASE_URL}/api/tests?${params}`, {
        timeout: 10000
      });

      if (append) {
        setTests(prev => [...prev, ...res.data.tests]);
      } else {
        setTests(res.data.tests);
      }
      setNextCursor(res.data.nextCursor);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Could not reach the server');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [levelFilter, unitFilter]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/tests/recent-attempts?limit=5`, {
          timeout: 10000
        });
        setRecentAttempts(res.data);
      } catch (err) {
        console.error('Failed to fetch recent attempts:', err);
      }
    };
    fetchRecent();
  }, []);

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
      await axios.delete(`${API_BASE_URL}/api/tests/${deleteModal.testId}`);
      setTests(tests.filter(t => t._id !== deleteModal.testId));
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

  const lastAttempt = recentAttempts[0];
  const scorePercent = lastAttempt
    ? Math.round((lastAttempt.score / lastAttempt.totalQuestions) * 100)
    : 0;

  const LEVEL_OPTIONS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
  const UNIT_OPTIONS = Array.from({ length: 20 }, (_, i) => `Unit ${i + 1}`);

  return (
    <div>
      <PageHeader>
        <h1>Your Tests</h1>
        <CreateButton to="/create">+ New Test</CreateButton>
      </PageHeader>

      {error && (
        <ErrorBanner>
          <span>{error}</span>
          <RetryButton onClick={() => fetchTests()}>Try again</RetryButton>
        </ErrorBanner>
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
          <SectionTitle>Recent Attempts</SectionTitle>
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
            <EndlessTitle>Endless Practice</EndlessTitle>
            <EndlessMeta>Random questions from the full library. No timer, no limits.</EndlessMeta>
          </EndlessInfo>
        </EndlessCard>
      </DashboardSection>

      <FilterBar>
        <SectionTitle style={{ margin: 0 }}>All Tests</SectionTitle>
        <FilterGroup>
          <FilterDropdown
            label="Level"
            value={levelFilter}
            options={LEVEL_OPTIONS}
            onChange={setLevelFilter}
          />
          <FilterDropdown
            label="Unit"
            value={unitFilter}
            options={UNIT_OPTIONS}
            onChange={setUnitFilter}
          />
          {total > 0 && <TestCount>{total} tests</TestCount>}
        </FilterGroup>
      </FilterBar>

      {!loading && !error && tests.length === 0 && (
        <EmptyState>
          <h2>No tests found</h2>
          <p>{levelFilter || unitFilter ? 'Try different filters.' : 'Create one to start practicing!'}</p>
          {!levelFilter && !unitFilter && (
            <CreateButton to="/create">Create a Test</CreateButton>
          )}
        </EmptyState>
      )}

      {tests.length > 0 && (
        <Grid>
          {tests.map(test => (
            <Card key={test._id} to={`/test/${test._id}`}>
              <DeleteButton
                onClick={(e) => handleDeleteClick(e, test._id, test.title)}
                aria-label={`Delete ${test.title}`}
              >
                &times;
              </DeleteButton>
              <CardTitle>{test.title}</CardTitle>
              <CardMeta>{test.questionCount} questions</CardMeta>
              {test.lastAttempt ? (
                <CardScore>
                  Last score: {test.lastAttempt.score}/{test.lastAttempt.totalQuestions}
                  {' '}({new Date(test.lastAttempt.createdAt).toLocaleDateString()})
                </CardScore>
              ) : (
                <CardNoAttempt>Not attempted yet</CardNoAttempt>
              )}
            </Card>
          ))}
        </Grid>
      )}

      {nextCursor && (
        <LoadMoreButton onClick={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : 'Load more tests'}
        </LoadMoreButton>
      )}

      {deleteModal.show && (
        <ModalOverlay onClick={cancelDelete}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <h3>Remove this test?</h3>
            <p>
              &ldquo;{deleteModal.testTitle}&rdquo; and its attempt history will be permanently removed.
            </p>
            <ModalActions>
              <ModalBtnCancel onClick={cancelDelete}>Keep it</ModalBtnCancel>
              <ModalBtnDanger onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Removing...' : 'Remove'}
              </ModalBtnDanger>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}
    </div>
  );
}

export default Home;
