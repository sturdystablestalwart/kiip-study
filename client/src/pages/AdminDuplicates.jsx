import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import useRequireAdmin from '../hooks/useRequireAdmin';
import FilterDropdown from '../components/FilterDropdown';
import { below } from '../theme/breakpoints';
import { Button, Card, Badge, EmptyState } from '../components/ui';
import { LEVEL_OPTIONS } from '../constants/levels';

/* ───────── Styled Components ───────── */

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
`;

const ControlBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[4]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
  flex-wrap: wrap;

  ${below.mobile} {
    flex-direction: column;
    align-items: stretch;
  }
`;

const ThresholdGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const ThresholdLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  white-space: nowrap;
`;

const ThresholdSlider = styled.input`
  width: 160px;
  accent-color: ${({ theme }) => theme.colors.accent.indigo};
  cursor: pointer;

  ${below.mobile} {
    width: 100%;
  }
`;

const ThresholdValue = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.accent.indigo};
  min-width: 40px;
`;

// ScanButton → Button $variant="accent" (kept as alias for readability)
const ScanButton = styled(Button).attrs({ $variant: 'accent' })``;

const SummaryBar = styled(Card).attrs({ $padding: 'sm' })`
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const ClusterList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[4]}px;
`;

const ClusterCard = styled(Card).attrs({ $padding: 'md' })``;

const ClusterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const SimilarityBadge = styled(Badge).attrs({ $color: 'warning' })``;

const KeepBothButton = styled(Button).attrs({ $variant: 'secondary', $size: 'compact' })``;

const QuestionPair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.layout.space[4]}px;

  ${below.mobile} {
    grid-template-columns: 1fr;
  }
`;

const QuestionSide = styled(Card).attrs({ $alt: true, $padding: 'sm', $radius: 'sm', $shadow: 'sm' })``;

const QuestionText = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  margin: 0 0 ${({ theme }) => theme.layout.space[2]}px 0;
`;

const QuestionSource = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin: 0;
`;

// EmptyState imported from ui components

const LoadingState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;

const ErrorBanner = styled.div`
  background: ${({ theme }) => theme.colors.state.wrongBg};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  color: ${({ theme }) => theme.colors.state.danger};
  padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
`;

/* ───────── Component ───────── */

function AdminDuplicates() {
  // Redirect + null-render handled by useRequireAdmin (#163).
  const adminReady = useRequireAdmin();
  const { t } = useTranslation();

  const [levelFilter, setLevelFilter] = useState('');
  const [threshold, setThreshold] = useState(0.75);
  const [scanning, setScanning] = useState(false);
  const [clusters, setClusters] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [error, setError] = useState(null);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setClusters(null);
    setDismissedIds(new Set());

    try {
      const params = new URLSearchParams();
      if (levelFilter) params.set('level', levelFilter);
      params.set('threshold', threshold.toString());

      const res = await api.get(`/api/admin/duplicates?${params}`);
      setClusters(res.data.clusters || []);
    } catch (err) {
      console.error('Scan failed:', err);
      setError(err.response?.data?.message || err.message || t('common.error'));
    } finally {
      setScanning(false);
    }
  }, [levelFilter, threshold, t]);

  const handleKeepBoth = (clusterId) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(clusterId);
      return next;
    });
  };

  // Issue #163 — shared admin gate.
  if (!adminReady) return null;

  const visibleClusters = clusters
    ? clusters.filter((_, idx) => !dismissedIds.has(idx))
    : null;

  const totalQuestions = visibleClusters
    ? visibleClusters.reduce((sum, c) => sum + (c.questions?.length || 0), 0)
    : 0;

  return (
    <div>
      <PageHeader>
        <Title>{t('admin.duplicates')}</Title>
      </PageHeader>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <ControlBar>
        <FilterDropdown
          label={t('home.level')}
          value={levelFilter}
          options={LEVEL_OPTIONS}
          onChange={setLevelFilter}
        />

        <ThresholdGroup>
          <ThresholdLabel htmlFor="threshold-slider">
            {t('admin.duplicatesThreshold')}
          </ThresholdLabel>
          <ThresholdSlider
            id="threshold-slider"
            type="range"
            min="0.50"
            max="1.00"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
          />
          <ThresholdValue>{Math.round(threshold * 100)}%</ThresholdValue>
        </ThresholdGroup>

        <ScanButton onClick={handleScan} disabled={scanning}>
          {scanning ? t('admin.duplicatesScanning') : t('admin.duplicatesScan')}
        </ScanButton>
      </ControlBar>

      {scanning && (
        <LoadingState>{t('admin.duplicatesScanning')}</LoadingState>
      )}

      {visibleClusters !== null && !scanning && (
        <>
          {visibleClusters.length > 0 && (
            <SummaryBar>
              {t('admin.duplicatesSummary', {
                clusters: visibleClusters.length,
                questions: totalQuestions
              })}
            </SummaryBar>
          )}

          {visibleClusters.length === 0 ? (
            <EmptyState
              icon="✓"
              title={t('admin.duplicatesEmpty')}
              description={t('admin.duplicatesEmpty')}
            />
          ) : (
            <ClusterList>
              {visibleClusters.map((cluster) => {
                const originalIdx = clusters.indexOf(cluster);
                const questions = cluster.questions || [];
                const similarity = cluster.similarity || 0;

                return (
                  <ClusterCard key={originalIdx}>
                    <ClusterHeader>
                      <SimilarityBadge>
                        {t('admin.duplicateScore', { score: Math.round(similarity * 100) })}
                      </SimilarityBadge>
                      <KeepBothButton onClick={() => handleKeepBoth(originalIdx)}>
                        {t('admin.keepBoth')}
                      </KeepBothButton>
                    </ClusterHeader>

                    <QuestionPair>
                      {questions.slice(0, 2).map((q, qIdx) => (
                        <QuestionSide key={qIdx}>
                          <QuestionText>{q.text}</QuestionText>
                          <QuestionSource>
                            {t('admin.duplicatesFromTest', { title: q.testTitle || '—' })}
                          </QuestionSource>
                        </QuestionSide>
                      ))}
                    </QuestionPair>
                  </ClusterCard>
                );
              })}
            </ClusterList>
          )}
        </>
      )}
    </div>
  );
}

export default AdminDuplicates;
