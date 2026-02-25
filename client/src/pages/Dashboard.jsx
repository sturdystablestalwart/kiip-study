import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { useTheme } from 'styled-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import { below } from '../theme/breakpoints';
import 'anychart';

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

const KpiCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[5]}px ${({ theme }) => theme.layout.space[6]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
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

const ChartContainer = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
  padding: ${({ theme }) => theme.layout.space[4]}px;
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

const HomeLink = styled(Link)`
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
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: #8B5340;
    color: ${({ theme }) => theme.colors.bg.surface};
  }
`;

const LoadingState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;

const SignInPrompt = styled.div`
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
    margin: 0 auto;
  }
`;

const AttemptList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[2]}px;
`;

const AttemptRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[4]}px;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;

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

const LoadMoreButton = styled.button`
  display: block;
  margin: ${({ theme }) => theme.layout.space[4]}px auto 0;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover { border-color: ${({ theme }) => theme.colors.focus.ring}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/* ───────── Helpers ───────── */

const QUESTION_TYPE_LABELS = {
  'mcq-single': 'MCQ Single',
  'mcq-multiple': 'MCQ Multiple',
  'short-answer': 'Short Answer',
  'ordering': 'Ordering',
  'fill-in-the-blank': 'Fill in Blank',
};

function applyChartTheme(chart, theme) {
  chart.background().fill(theme.colors.bg.surface);
  chart.title().fontFamily(theme.typography.fontSans);
  chart.title().fontColor(theme.colors.text.primary);
  chart.title().fontSize(theme.typography.scale.h3.size);
  chart.title().fontWeight(theme.typography.scale.h3.weight);
}

function styleAxis(axis, theme) {
  if (!axis) return;
  axis.labels().fontColor(theme.colors.text.muted);
  axis.labels().fontFamily(theme.typography.fontSans);
  axis.labels().fontSize(theme.typography.scale.micro.size);
  if (axis.title) {
    axis.title().fontColor(theme.colors.text.muted);
    axis.title().fontFamily(theme.typography.fontSans);
  }
  if (axis.stroke) {
    axis.stroke(theme.colors.border.subtle);
  }
  if (axis.ticks) {
    axis.ticks().stroke(theme.colors.border.subtle);
  }
}

/* ───────── Component ───────── */

function Dashboard() {
  const { user } = useAuth();
  const { isDark } = useThemeMode();
  const theme = useTheme();
  const { t } = useTranslation();

  const [stats, setStats] = useState(null);
  const [typeStats, setTypeStats] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [attemptsNextCursor, setAttemptsNextCursor] = useState(null);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  const lineRef = useRef(null);
  const barRef = useRef(null);
  const radarRef = useRef(null);

  const lineChartRef = useRef(null);
  const barChartRef = useRef(null);
  const radarChartRef = useRef(null);

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

  // Line chart: Accuracy Over Time
  useEffect(() => {
    if (!stats?.accuracyTrend?.length || !lineRef.current) return;

    // Dispose previous chart
    if (lineChartRef.current) {
      lineChartRef.current.dispose();
      lineChartRef.current = null;
    }

    const chart = window.anychart.line();
    lineChartRef.current = chart;

    const data = stats.accuracyTrend.map(d => [d.date, d.score]);
    const series = chart.line(data);
    series.stroke(theme.colors.accent.indigo, 2);
    series.name(t('dashboard.accuracyOverTime'));

    // Markers
    series.markers().enabled(true);
    series.markers().size(4);
    series.markers().fill(theme.colors.accent.indigo);
    series.markers().stroke(theme.colors.bg.surface, 1);

    // Tooltip
    chart.tooltip().format('{%value}%');

    chart.title(false);
    applyChartTheme(chart, theme);
    chart.title(false);
    chart.background().fill('transparent');

    // Y axis
    const yAxis = chart.yAxis();
    styleAxis(yAxis, theme);
    yAxis.title(false);
    chart.yScale().minimum(0);
    chart.yScale().maximum(100);

    // X axis
    const xAxis = chart.xAxis();
    styleAxis(xAxis, theme);
    xAxis.title(false);

    // Grid
    chart.yGrid().enabled(true);
    chart.yGrid().stroke(theme.colors.border.subtle, 1, '5 5');

    chart.container(lineRef.current);
    chart.draw();

    return () => {
      if (lineChartRef.current) {
        lineChartRef.current.dispose();
        lineChartRef.current = null;
      }
    };
  }, [stats, isDark, t, theme]);

  // Bar chart: Score by Unit
  useEffect(() => {
    if (!stats?.unitBreakdown?.length || !barRef.current) return;

    if (barChartRef.current) {
      barChartRef.current.dispose();
      barChartRef.current = null;
    }

    const chart = window.anychart.bar();
    barChartRef.current = chart;

    const data = stats.unitBreakdown.map(u => [u.unit || 'N/A', u.avgScore]);
    const series = chart.bar(data);
    series.fill(theme.colors.accent.moss);
    series.stroke(theme.colors.accent.moss, 1);
    series.name(t('dashboard.scoreByUnit'));

    chart.tooltip().format('{%value}%');

    chart.title(false);
    chart.background().fill('transparent');

    const yAxis = chart.yAxis();
    styleAxis(yAxis, theme);
    yAxis.title(false);
    chart.yScale().minimum(0);
    chart.yScale().maximum(100);

    const xAxis = chart.xAxis();
    styleAxis(xAxis, theme);
    xAxis.title(false);

    chart.yGrid().enabled(true);
    chart.yGrid().stroke(theme.colors.border.subtle, 1, '5 5');

    chart.container(barRef.current);
    chart.draw();

    return () => {
      if (barChartRef.current) {
        barChartRef.current.dispose();
        barChartRef.current = null;
      }
    };
  }, [stats, isDark, t, theme]);

  // Radar chart: Performance by Question Type
  useEffect(() => {
    if (!typeStats?.types?.length || !radarRef.current) return;

    if (radarChartRef.current) {
      radarChartRef.current.dispose();
      radarChartRef.current = null;
    }

    const chart = window.anychart.radar();
    radarChartRef.current = chart;

    const data = typeStats.types.map(qt => [
      QUESTION_TYPE_LABELS[qt.type] || qt.type,
      qt.accuracy,
    ]);

    const series = chart.area(data);
    series.fill(theme.colors.accent.indigo, 0.2);
    series.stroke(theme.colors.accent.indigo, 2);
    series.markers().enabled(true);
    series.markers().size(4);
    series.markers().fill(theme.colors.accent.indigo);
    series.markers().stroke(theme.colors.bg.surface, 1);
    series.name(t('dashboard.byQuestionType'));

    chart.tooltip().format('{%value}%');

    chart.title(false);
    chart.background().fill('transparent');

    chart.yScale().minimum(0);
    chart.yScale().maximum(100);
    chart.yScale().ticks().interval(25);

    // Style radar axes
    const yAxis = chart.yAxis();
    if (yAxis) {
      yAxis.labels().fontColor(theme.colors.text.faint);
      yAxis.labels().fontFamily(theme.typography.fontSans);
      yAxis.labels().fontSize(theme.typography.scale.micro.size);
      yAxis.stroke(theme.colors.border.subtle);
    }

    const xAxis = chart.xAxis();
    if (xAxis) {
      xAxis.labels().fontColor(theme.colors.text.muted);
      xAxis.labels().fontFamily(theme.typography.fontSans);
      xAxis.labels().fontSize(theme.typography.scale.micro.size);
    }

    // Grid styling
    chart.yGrid().enabled(true);
    chart.yGrid().stroke(theme.colors.border.subtle, 1, '3 3');
    chart.xGrid().enabled(true);
    chart.xGrid().stroke(theme.colors.border.subtle, 1);

    chart.container(radarRef.current);
    chart.draw();

    return () => {
      if (radarChartRef.current) {
        radarChartRef.current.dispose();
        radarChartRef.current = null;
      }
    };
  }, [typeStats, isDark, t, theme]);

  // Not signed in
  if (!user) {
    return (
      <div>
        <PageHeader>
          <h1>{t('dashboard.title')}</h1>
        </PageHeader>
        <SignInPrompt>
          <h2>{t('nav.signIn')}</h2>
          <p>{t('dashboard.noData')}</p>
        </SignInPrompt>
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
        <EmptyState>
          <h2>{t('dashboard.title')}</h2>
          <p>{t('dashboard.noData')}</p>
          <HomeLink to="/">{t('test.goHome')}</HomeLink>
        </EmptyState>
      </div>
    );
  }

  const { kpis, accuracyTrend, unitBreakdown } = stats;

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
        <KpiCard>
          <KpiLabel>{t('dashboard.totalAttempts')}</KpiLabel>
          <KpiValue $accent>{kpis.totalAttempts}</KpiValue>
        </KpiCard>
        <KpiCard>
          <KpiLabel>{t('dashboard.avgScore')}</KpiLabel>
          <KpiValue>{kpis.averageScore}%</KpiValue>
        </KpiCard>
        <KpiCard>
          <KpiLabel>{t('dashboard.streak')}</KpiLabel>
          <KpiValue>{kpis.currentStreak}</KpiValue>
          <KpiSub>
            {kpis.currentStreak === 1
              ? '1 day'
              : `${kpis.currentStreak} days`}
          </KpiSub>
        </KpiCard>
        <KpiCard>
          <KpiLabel>{t('dashboard.weakestUnit')}</KpiLabel>
          <KpiValue>
            {kpis.weakestUnit ? kpis.weakestUnit.unit || '—' : '—'}
          </KpiValue>
          {kpis.weakestUnit && (
            <KpiSub>{kpis.weakestUnit.avgScore}%</KpiSub>
          )}
        </KpiCard>
      </KpiGrid>

      {/* Line chart: Accuracy Over Time */}
      {accuracyTrend && accuracyTrend.length > 0 && (
        <ChartSection>
          <ChartTitle>{t('dashboard.accuracyOverTime')}</ChartTitle>
          <ChartContainer $height={300}>
            <div ref={lineRef} style={{ width: '100%', height: '100%' }} />
          </ChartContainer>
        </ChartSection>
      )}

      {/* Two charts side by side */}
      <TwoChartGrid>
        {/* Bar chart: Score by Unit */}
        {unitBreakdown && unitBreakdown.length > 0 && (
          <div>
            <ChartTitle>{t('dashboard.scoreByUnit')}</ChartTitle>
            <ChartContainer $height={250}>
              <div ref={barRef} style={{ width: '100%', height: '100%' }} />
            </ChartContainer>
          </div>
        )}

        {/* Radar chart: Performance by Question Type */}
        {typeStats?.types && typeStats.types.length > 0 && (
          <div>
            <ChartTitle>{t('dashboard.byQuestionType')}</ChartTitle>
            <ChartContainer $height={250}>
              <div ref={radarRef} style={{ width: '100%', height: '100%' }} />
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
              <AttemptRow key={a._id}>
                <AttemptTitle>{a.test?.title || t('common.unknown')}</AttemptTitle>
                <AttemptScore>{a.score}/{a.totalQuestions}</AttemptScore>
                <AttemptMeta>{a.mode}</AttemptMeta>
                <AttemptMeta>{new Date(a.createdAt).toLocaleDateString()}</AttemptMeta>
              </AttemptRow>
            ))}
          </AttemptList>
          {attemptsNextCursor && (
            <LoadMoreButton
              onClick={() => fetchAttempts(attemptsNextCursor)}
              disabled={loadingAttempts}
            >
              {loadingAttempts ? t('common.loading') : t('dashboard.loadMore')}
            </LoadMoreButton>
          )}
        </ChartSection>
      )}
    </div>
  );
}

export default Dashboard;
