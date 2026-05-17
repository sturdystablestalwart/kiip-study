import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateFormat';
import { useAuth } from '../context/AuthContext';
import { below } from '../theme/breakpoints';
import { Button, Card, EmptyState } from '../components/ui';
// Issue #10 — chart rendering + AnyChart side-effects moved to dedicated
// per-chart components.  Bootstrap module loads only the AnyChart
// submodules these charts need and applies the optional licence key.
import '../components/dashboard/anychartBootstrap';
import AccuracyTrendChart from '../components/dashboard/AccuracyTrendChart';
import UnitBreakdownChart from '../components/dashboard/UnitBreakdownChart';
import QuestionTypeRadar from '../components/dashboard/QuestionTypeRadar';

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

const PeriodSelect = styled.select`
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
  }
`;

const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.layout.space[4]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[7]}px;

  ${below.tablet} {
    grid-template-columns: repeat(2, 1fr);
  }
  ${below.mobile} {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.layout.space[3]}px;
  }
`;

// KpiCard: Card with sm radius and md padding — extend for text alignment
const KpiCard = styled(Card)`
  text-align: left;
`;

const KpiLabel = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  margin: 0 0 ${({ theme }) => theme.layout.space[1]}px 0;
`;

const KpiValue = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ $accent, theme }) => $accent ? theme.colors.accent.clay : theme.colors.text.primary};
  margin: 0;
  line-height: ${({ theme }) => theme.typography.scale.h2.line}px;
`;

const KpiSub = styled.span`
  display: block;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin-top: ${({ theme }) => theme.layout.space[1]}px;
`;

const ChartSection = styled.section`
  margin-bottom: ${({ theme }) => theme.layout.space[7]}px;
`;

const ChartTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.layout.space[4]}px 0;
`;

// ChartContainer: Card with sm padding — extend for fixed height
const ChartContainer = styled(Card)`
  height: ${({ $height }) => $height || 300}px;
`;

const TwoChartGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.layout.space[5]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[7]}px;

  ${below.tablet} {
    grid-template-columns: 1fr;
  }
`;

// EmptyState is now imported from ../components/ui

// HomeLink is now rendered as <Button as={Link} to="/">


const LoadingState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;

// SignInPrompt is now rendered as <EmptyState> from ../components/ui


const AttemptList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[2]}px;
`;

// AttemptRow: Card with sm padding and sm radius, extended for flex layout
const AttemptRow = styled(Card)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[4]}px;

  ${below.mobile} {
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.layout.space[2]}px;
  }
`;

const AttemptTitle = styled.span`
  flex: 1;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.primary};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AttemptMeta = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  white-space: nowrap;
`;

const AttemptScore = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent.moss};
  white-space: nowrap;
`;

// LoadMoreButton: Button secondary compact, centered with margin
const LoadMoreButton = styled(Button)`
  display: block;
  margin: ${({ theme }) => theme.layout.space[4]}px auto 0;
`;

const CompareButton = styled.button`
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.accent.indigo};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: transparent;
  color: ${({ theme }) => theme.colors.accent.indigo};
  font-family: inherit;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.accent.indigo};
    color: ${({ theme }) => theme.colors.bg.surface};
  }
`;

const ComparePanel = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  padding: ${({ theme }) => theme.layout.space[5]}px;
  margin-top: ${({ theme }) => theme.layout.space[4]}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
`;

const ComparePanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;

  h3 { margin: 0; }
`;

const CloseCompareBtn = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  color: ${({ theme }) => theme.colors.text.faint};
  cursor: pointer;
  padding: ${({ theme }) => theme.layout.space[2]}px;
`;

const CompareGrid = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  overflow-x: auto;
`;

const CompareCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  padding: ${({ theme }) => theme.layout.space[4]}px;
  text-align: center;
  min-width: 100px;
  flex-shrink: 0;
`;

const CompareDate = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin-bottom: ${({ theme }) => theme.layout.space[2]}px;
`;

const CompareScore = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ $percent, theme }) =>
    $percent >= 70 ? theme.colors.accent.moss :
    $percent >= 50 ? theme.colors.state.warning :
    theme.colors.state.danger};
`;

const CompareMeta = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  margin-top: ${({ theme }) => theme.layout.space[2]}px;
`;

const ReviewLink = styled(Link)`
  display: inline-block;
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.accent.indigo};
  text-decoration: none;

  &:hover { text-decoration: underline; }
`;

/* ───────── Helpers ───────── */

/* ───────── Component ───────── */
/* Issue #10 — QUESTION_TYPE_KEYS, applyChartTheme, styleAxis moved
   alongside the chart components in client/src/components/dashboard/. */

function Dashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const [stats, setStats] = useState(null);
  const [typeStats, setTypeStats] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [attemptsNextCursor, setAttemptsNextCursor] = useState(null);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [compareTestId, setCompareTestId] = useState(null);
  const [compareAttempts, setCompareAttempts] = useState([]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [statsRes, typesRes] = await Promise.all([
          api.get(`/api/stats?period=${period}`, { signal: controller.signal }),
          api.get('/api/stats/question-types', { signal: controller.signal }),
        ]);
        setStats(statsRes.data);
        setTypeStats(typesRes.data);
      } catch (err) {
        if (err.name === 'CanceledError') return;
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    return () => controller.abort();
  }, [period, user]);

  const fetchAttempts = useCallback(async (cursor = null) => {
    setLoadingAttempts(true);
    try {
      const params = new URLSearchParams({ limit: '10' });
      if (cursor) params.set('cursor', cursor);
      const res = await api.get(`/api/tests/attempts?${params}`);
      if (cursor) {
        setAttempts(prev => [...prev, ...res.data.attempts]);
      } else {
        setAttempts(res.data.attempts);
      }
      setAttemptsNextCursor(res.data.nextCursor);
    } catch (err) {
      if (err.name === 'CanceledError') return;
      console.error('Failed to fetch attempts', err);
    } finally {
      setLoadingAttempts(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchAttempts();
  }, [user, fetchAttempts]);

  // Issue #10 — chart rendering lives in AccuracyTrendChart /
  // UnitBreakdownChart / QuestionTypeRadar.  Each owns its own
  // window.anychart instance, ref, dispose-on-unmount, and
  // dark-mode re-render.

  // Not signed in
  if (!user) {
    return (
      <div>
        <PageHeader>
          <h1>{t('dashboard.title')}</h1>
        </PageHeader>
        <EmptyState
          icon="🔒"
          title={t('nav.signIn')}
          description={t('dashboard.noData')}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader>
          <h1>{t('dashboard.title')}</h1>
        </PageHeader>
        <LoadingState>{t('common.loading')}</LoadingState>
      </div>
    );
  }

  const hasData = stats && stats.kpis && stats.kpis.totalAttempts > 0;

  if (!hasData) {
    return (
      <div>
        <PageHeader>
          <h1>{t('dashboard.title')}</h1>
        </PageHeader>
        <EmptyState
          icon="📊"
          title={t('dashboard.title')}
          description={t('dashboard.noData')}
        >
          <Button as={Link} to="/">{t('test.goHome')}</Button>
        </EmptyState>
      </div>
    );
  }

  const { kpis, accuracyTrend, unitBreakdown } = stats;

  const attemptsByTest = {};
  attempts.forEach(a => {
    if (!a.testId) return;
    const key = a.testId._id || a.testId;
    if (!attemptsByTest[key]) attemptsByTest[key] = [];
    attemptsByTest[key].push(a);
  });

  return (
    <div>
      <PageHeader>
        <h1>{t('dashboard.title')}</h1>
        <PeriodSelect
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label={t('dashboard.period')}
        >
          <option value="7d">{t('dashboard.days7')}</option>
          <option value="30d">{t('dashboard.days30')}</option>
          <option value="90d">{t('dashboard.days90')}</option>
          <option value="all">{t('dashboard.allTime')}</option>
        </PeriodSelect>
      </PageHeader>

      {/* KPI cards */}
      <KpiGrid>
        <KpiCard $padding="md" $radius="sm">
          <KpiLabel>{t('dashboard.totalAttempts')}</KpiLabel>
          <KpiValue $accent>{kpis.totalAttempts}</KpiValue>
        </KpiCard>
        <KpiCard $padding="md" $radius="sm">
          <KpiLabel>{t('dashboard.avgScore')}</KpiLabel>
          <KpiValue>{kpis.averageScore}%</KpiValue>
        </KpiCard>
        <KpiCard $padding="md" $radius="sm">
          <KpiLabel>{t('dashboard.streak')}</KpiLabel>
          <KpiValue>{kpis.currentStreak}</KpiValue>
          <KpiSub>
            {t('dashboard.streakDays', { count: kpis.currentStreak })}
          </KpiSub>
        </KpiCard>
        <KpiCard $padding="md" $radius="sm">
          <KpiLabel>{t('dashboard.weakestUnit')}</KpiLabel>
          <KpiValue>
            {kpis.weakestUnit ? kpis.weakestUnit.unit || '—' : '—'}
          </KpiValue>
          {kpis.weakestUnit && (
            <KpiSub>{kpis.weakestUnit.avgScore}%</KpiSub>
          )}
        </KpiCard>
      </KpiGrid>
      <ReviewLink to="/review">{t('dashboard.reviewFailedLink')}</ReviewLink>

      {/* Line chart: Accuracy Over Time */}
      {accuracyTrend && accuracyTrend.length > 0 && (
        <ChartSection>
          <ChartTitle>{t('dashboard.accuracyOverTime')}</ChartTitle>
          <ChartContainer $padding="sm" $height={300}>
            <AccuracyTrendChart data={accuracyTrend} />
          </ChartContainer>
        </ChartSection>
      )}

      {/* Two charts side by side */}
      <TwoChartGrid>
        {/* Bar chart: Score by Unit */}
        {unitBreakdown && unitBreakdown.length > 0 && (
          <div>
            <ChartTitle>{t('dashboard.scoreByUnit')}</ChartTitle>
            <ChartContainer $padding="sm" $height={250}>
              <UnitBreakdownChart data={unitBreakdown} />
            </ChartContainer>
          </div>
        )}

        {/* Radar chart: Performance by Question Type */}
        {typeStats?.types && typeStats.types.length > 0 && (
          <div>
            <ChartTitle>{t('dashboard.byQuestionType')}</ChartTitle>
            <ChartContainer $padding="sm" $height={250}>
              <QuestionTypeRadar data={typeStats.types} />
            </ChartContainer>
          </div>
        )}
      </TwoChartGrid>

      {/* Attempt History */}
      {attempts.length > 0 && (
        <ChartSection>
          <ChartTitle>{t('dashboard.recentAttempts')}</ChartTitle>
          <AttemptList>
            {attempts.map(a => (
              <AttemptRow key={a._id} $padding="sm" $radius="sm">
                <AttemptTitle>{a.test?.title || t('common.unknown')}</AttemptTitle>
                <AttemptScore>{a.score}/{a.totalQuestions}</AttemptScore>
                <AttemptMeta>{a.mode}</AttemptMeta>
                <AttemptMeta>{formatDate(a.createdAt, i18n.resolvedLanguage)}</AttemptMeta>
                {attemptsByTest[a.testId?._id || a.testId]?.length >= 2 && (
                  <CompareButton
                    data-testid="compare-attempts"
                    onClick={() => {
                      const key = a.testId?._id || a.testId;
                      setCompareTestId(key);
                      setCompareAttempts(attemptsByTest[key].slice(0, 5));
                    }}
                  >
                    {t('dashboard.compare')}
                  </CompareButton>
                )}
              </AttemptRow>
            ))}
          </AttemptList>
          {attemptsNextCursor && (
            <LoadMoreButton
              $variant="secondary"
              $size="compact"
              onClick={() => fetchAttempts(attemptsNextCursor)}
              disabled={loadingAttempts}
            >
              {loadingAttempts ? t('common.loading') : t('dashboard.loadMore')}
            </LoadMoreButton>
          )}
          {compareTestId && compareAttempts.length > 0 && (
            <ComparePanel>
              <ComparePanelHeader>
                <h3>{compareAttempts[0]?.test?.title || t('dashboard.testComparison')}</h3>
                <CloseCompareBtn onClick={() => setCompareTestId(null)}>&times;</CloseCompareBtn>
              </ComparePanelHeader>
              <CompareGrid>
                {compareAttempts.map((a) => {
                  const pct = Math.round((a.score / a.totalQuestions) * 100);
                  return (
                    <CompareCard key={a._id}>
                      <CompareDate>{formatDate(a.createdAt, i18n.resolvedLanguage)}</CompareDate>
                      <CompareScore $percent={pct}>{pct}%</CompareScore>
                      <CompareMeta>{a.score}/{a.totalQuestions} · {Math.floor(a.duration / 60)}m</CompareMeta>
                    </CompareCard>
                  );
                })}
              </CompareGrid>
            </ComparePanel>
          )}
        </ChartSection>
      )}
    </div>
  );
}

export default Dashboard;
