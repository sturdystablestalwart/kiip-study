import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const FilterTabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const Tab = styled.button`
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.accent.indigo : theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  background: ${({ $active, theme }) => $active ? theme.colors.accent.indigo : 'transparent'};
  color: ${({ $active, theme }) => $active ? theme.colors.onAccent : theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
  }
`;

const FlagList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const FlagCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  padding: ${({ theme }) => theme.layout.space[5]}px;
`;

const FlagHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const FlagInfo = styled.div`
  flex: 1;
`;

const FlagTest = styled(Link)`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: 550;
  color: ${({ theme }) => theme.colors.accent.indigo};
  text-decoration: none;

  &:hover { text-decoration: underline; }
`;

const FlagMeta = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin: ${({ theme }) => theme.layout.space[1]}px 0;
`;

const FlagReason = styled.span`
  display: inline-block;
  padding: 2px ${({ theme }) => theme.layout.space[3]}px;
  background: ${({ theme }) => theme.colors.state.infoBg};
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.accent.indigo};
`;

const FlagNote = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  margin: ${({ theme }) => theme.layout.space[3]}px 0;
  padding: ${({ theme }) => theme.layout.space[3]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
`;

const FlagActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  align-items: center;
`;

const ActionBtn = styled.button`
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    color: ${({ theme }) => theme.colors.accent.indigo};
  }

  &:disabled { opacity: 0.5; cursor: default; }
`;

const ResolveBtn = styled(ActionBtn)`
  background: ${({ theme }) => theme.colors.state.success};
  color: ${({ theme }) => theme.colors.onAccent};
  border-color: ${({ theme }) => theme.colors.state.success};

  &:hover { opacity: 0.85; border-color: ${({ theme }) => theme.colors.state.success}; color: ${({ theme }) => theme.colors.onAccent}; }
`;

const ResolutionInput = styled.input`
  flex: 1;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const LoadMoreButton = styled.button`
  display: block;
  margin: ${({ theme }) => theme.layout.space[6]}px auto;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[6]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  cursor: pointer;

  &:hover { border-color: ${({ theme }) => theme.colors.focus.ring}; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[8]}px;
  color: ${({ theme }) => theme.colors.text.faint};
`;

// REASON_LABELS moved inside component for i18n access

function AdminFlags() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { t } = useTranslation();
    const [flags, setFlags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('open');
    const [nextCursor, setNextCursor] = useState(null);
    const [resolutions, setResolutions] = useState({});
    const [updating, setUpdating] = useState({});

    const REASON_LABELS = {
        'incorrect-answer': t('flag.incorrectAnswer'),
        'unclear-question': t('flag.unclearQuestion'),
        'typo': t('flag.typo'),
        'other': t('flag.other')
    };

    const STATUS_LABELS = {
        'open': t('admin.flagsOpen'),
        'resolved': t('admin.flagsResolved'),
        'dismissed': t('admin.flagsDismissed')
    };

    const fetchFlags = useCallback(async (cursor = null, append = false, signal) => {
        try {
            if (!append) setLoading(true);
            const params = new URLSearchParams({ status: statusFilter, limit: '20' });
            if (cursor) params.set('cursor', cursor);
            const res = await api.get(`/api/admin/flags?${params}`, { signal });
            setFlags(prev => append ? [...prev, ...res.data.flags] : res.data.flags);
            setNextCursor(res.data.nextCursor);
        } catch (err) {
            if (err.name === 'CanceledError') return;
            console.error('Failed to fetch flags:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        if (!authLoading && !user?.isAdmin) {
            navigate('/');
            return;
        }
        if (!authLoading && user?.isAdmin) {
            const controller = new AbortController();
            fetchFlags(null, false, controller.signal);
            return () => controller.abort();
        }
    }, [authLoading, user, fetchFlags, navigate]);

    const handleUpdateFlag = async (flagId, status) => {
        setUpdating(prev => ({ ...prev, [flagId]: true }));
        try {
            await api.patch(`/api/admin/flags/${flagId}`, {
                status,
                resolution: resolutions[flagId] || ''
            });
            setFlags(prev => prev.filter(f => f._id !== flagId));
        } catch (err) {
            console.error('Failed to update flag:', err);
        } finally {
            setUpdating(prev => ({ ...prev, [flagId]: false }));
        }
    };

    if (authLoading) return null;

    return (
        <div>
            <PageHeader>
                <Title>{t('admin.flags')}</Title>
            </PageHeader>

            <FilterTabs>
                {['open', 'resolved', 'dismissed'].map(s => (
                    <Tab
                        key={s}
                        $active={statusFilter === s}
                        onClick={() => setStatusFilter(s)}
                    >
                        {STATUS_LABELS[s]}
                    </Tab>
                ))}
            </FilterTabs>

            {loading ? (
                <EmptyState>{t('common.loading')}</EmptyState>
            ) : flags.length === 0 ? (
                <EmptyState>{STATUS_LABELS[statusFilter]} - 0</EmptyState>
            ) : (
                <FlagList>
                    {flags.map(flag => (
                        <FlagCard key={flag._id}>
                            <FlagHeader>
                                <FlagInfo>
                                    <FlagTest to={`/admin/tests/${flag.testId?._id}/edit`}>
                                        {flag.testId?.title || 'Unknown test'}
                                    </FlagTest>
                                    {flag.questionIndex != null && (
                                        <FlagMeta>Question {flag.questionIndex + 1}</FlagMeta>
                                    )}
                                    <FlagMeta>
                                        By {flag.userId?.displayName || flag.userId?.email || 'Unknown'}
                                        {' '}&middot; {new Date(flag.createdAt).toLocaleDateString()}
                                    </FlagMeta>
                                </FlagInfo>
                                <FlagReason>{REASON_LABELS[flag.reason] || flag.reason}</FlagReason>
                            </FlagHeader>

                            {flag.note && <FlagNote>{flag.note}</FlagNote>}

                            {statusFilter === 'open' && (
                                <FlagActions>
                                    <ResolutionInput
                                        placeholder={t('admin.resolution')}
                                        value={resolutions[flag._id] || ''}
                                        onChange={e => setResolutions(prev => ({
                                            ...prev,
                                            [flag._id]: e.target.value
                                        }))}
                                    />
                                    <ResolveBtn
                                        onClick={() => handleUpdateFlag(flag._id, 'resolved')}
                                        disabled={updating[flag._id]}
                                    >
                                        {t('admin.resolve')}
                                    </ResolveBtn>
                                    <ActionBtn
                                        onClick={() => handleUpdateFlag(flag._id, 'dismissed')}
                                        disabled={updating[flag._id]}
                                    >
                                        {t('admin.dismiss')}
                                    </ActionBtn>
                                </FlagActions>
                            )}

                            {flag.resolution && (
                                <FlagNote>Resolution: {flag.resolution}</FlagNote>
                            )}
                        </FlagCard>
                    ))}
                </FlagList>
            )}

            {nextCursor && (
                <LoadMoreButton onClick={() => fetchFlags(nextCursor, true)}>
                    {t('home.loadMore')}
                </LoadMoreButton>
            )}
        </div>
    );
}

export default AdminFlags;
