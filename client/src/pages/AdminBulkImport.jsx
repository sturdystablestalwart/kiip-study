import React, { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { below } from '../theme/breakpoints';

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

const TemplateButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  color: ${({ theme }) => theme.colors.accent.indigo};
  border: 1px solid ${({ theme }) => theme.colors.accent.indigo};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.accent.indigo};
    color: #fff;
  }
`;

const DropZone = styled.div`
  padding: ${({ theme }) => theme.layout.space[8]}px ${({ theme }) => theme.layout.space[5]}px;
  border: 2px dashed ${({ $isDragOver, $hasError, theme }) =>
    $hasError ? theme.colors.state.danger :
    $isDragOver ? theme.colors.accent.indigo :
    theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  text-align: center;
  background: ${({ $isDragOver, theme }) =>
    $isDragOver ? theme.colors.state.infoBg : theme.colors.bg.surfaceAlt};
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease};
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    background: ${({ theme }) => theme.colors.state.infoBg};
  }
`;

const DropZoneText = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  margin: 0 0 ${({ theme }) => theme.layout.space[2]}px 0;
`;

const DropZoneHint = styled.p`
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  margin: 0;
`;

const HiddenInput = styled.input`
  display: none;
`;

const FileName = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[4]}px;
  background: ${({ theme }) => theme.colors.state.infoBg};
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.accent.indigo};
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
`;

const RemoveFile = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  line-height: 1;

  &:hover {
    color: ${({ theme }) => theme.colors.state.danger};
  }
`;

const SummaryBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[3]}px;

  ${below.mobile} {
    flex-direction: column;
    align-items: stretch;
  }
`;

const SummaryText = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const ConfirmButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[6]}px;
  background: ${({ theme }) => theme.colors.accent.clay};
  color: ${({ theme }) => theme.colors.bg.surface};
  border: none;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  font-family: inherit;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: #8B5340;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const PreviewSection = styled.div`
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const PreviewTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const TestRow = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-left: 3px solid ${({ $status, theme }) =>
    $status === 'valid' ? theme.colors.state.success :
    $status === 'error' ? theme.colors.state.danger :
    theme.colors.state.warning};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[5]}px;
`;

const TestRowHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  flex-wrap: wrap;
`;

const TestRowTitle = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const TestRowMeta = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px ${({ theme }) => theme.layout.space[3]}px;
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  background: ${({ $status, theme }) =>
    $status === 'valid' ? theme.colors.state.correctBg :
    $status === 'error' ? theme.colors.state.wrongBg :
    `${theme.colors.state.warning}20`};
  color: ${({ $status, theme }) =>
    $status === 'valid' ? theme.colors.state.success :
    $status === 'error' ? theme.colors.state.danger :
    theme.colors.state.warning};
`;

const ErrorList = styled.ul`
  margin: ${({ theme }) => theme.layout.space[2]}px 0 0 0;
  padding-left: ${({ theme }) => theme.layout.space[5]}px;
  list-style: disc;
`;

const ErrorItem = styled.li`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.state.danger};
  line-height: ${({ theme }) => theme.typography.scale.small.line}px;
`;

const DuplicateWarning = styled.div`
  margin-top: ${({ theme }) => theme.layout.space[2]}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.state.warning};
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  background: ${({ theme }) => `${theme.colors.state.warning}10`};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
`;

const ResultBanner = styled.div`
  padding: ${({ theme }) => theme.layout.space[5]}px ${({ theme }) => theme.layout.space[6]}px;
  background: ${({ theme }) => theme.colors.state.correctBg};
  border: 1px solid ${({ theme }) => theme.colors.state.success}33;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  color: ${({ theme }) => theme.colors.state.success};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
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

const LoadingState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;

/* ───────── Component ───────── */

function AdminBulkImport() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'csv'].includes(ext)) {
      setError(t('admin.importAcceptedFormats'));
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
    setPreview(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await api.post('/api/admin/tests/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(res.data);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.message || err.message || t('common.error'));
    } finally {
      setUploading(false);
    }
  }, [t]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!preview?.previewId) return;

    setConfirming(true);
    setError(null);

    try {
      const res = await api.post('/api/admin/tests/bulk-import/confirm', {
        previewId: preview.previewId
      });
      setResult(res.data);
      setPreview(null);
    } catch (err) {
      console.error('Confirm failed:', err);
      setError(err.response?.data?.message || err.message || t('common.error'));
    } finally {
      setConfirming(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open(`${apiBaseUrl}/api/admin/tests/import-template`, '_blank');
  };

  // Redirect non-admins
  if (!authLoading && !user?.isAdmin) {
    navigate('/');
    return null;
  }

  if (authLoading) return null;

  const getTestStatus = (test) => {
    if (test.errors && test.errors.length > 0) return 'error';
    if (test.duplicateWarnings && test.duplicateWarnings.length > 0) return 'warning';
    return 'valid';
  };

  const getStatusLabel = (status) => {
    if (status === 'valid') return t('admin.importValid');
    if (status === 'error') return t('admin.importHasErrors');
    return t('admin.importHasDuplicates');
  };

  const readyCount = preview?.tests?.filter(t => getTestStatus(t) === 'valid').length || 0;
  const errorCount = preview?.tests?.filter(t => getTestStatus(t) === 'error').length || 0;
  const warningCount = preview?.tests?.filter(t => getTestStatus(t) === 'warning').length || 0;

  return (
    <div>
      <PageHeader>
        <Title>{t('admin.import')}</Title>
        <TemplateButton onClick={handleDownloadTemplate}>
          {t('admin.importTemplate')}
        </TemplateButton>
      </PageHeader>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {result && (
        <ResultBanner>
          {t('admin.importResult', {
            imported: result.imported || 0,
            skipped: result.skipped || 0,
            errors: result.errors || 0
          })}
        </ResultBanner>
      )}

      <DropZone
        $isDragOver={isDragOver}
        $hasError={!!error && !file}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowse}
      >
        <DropZoneText>
          {uploading ? t('admin.importUploading') : t('admin.importDragDrop')}
        </DropZoneText>
        <DropZoneHint>{t('admin.importAcceptedFormats')}</DropZoneHint>
        {file && (
          <FileName>
            {file.name}
            <RemoveFile
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFile();
              }}
              aria-label={t('common.close')}
            >
              &times;
            </RemoveFile>
          </FileName>
        )}
        <HiddenInput
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleInputChange}
        />
      </DropZone>

      {uploading && (
        <LoadingState>{t('admin.importUploading')}</LoadingState>
      )}

      {preview && preview.tests && preview.tests.length > 0 && (
        <>
          <SummaryBar>
            <SummaryText>
              {t('admin.importSummary', {
                ready: readyCount,
                errors: errorCount,
                warnings: warningCount
              })}
            </SummaryText>
            <ConfirmButton
              onClick={handleConfirm}
              disabled={confirming || readyCount === 0}
            >
              {confirming ? t('admin.importConfirming') : t('admin.importConfirm')}
            </ConfirmButton>
          </SummaryBar>

          <PreviewSection>
            <PreviewTable>
              {preview.tests.map((test, idx) => {
                const status = getTestStatus(test);
                return (
                  <TestRow key={test.title || idx} $status={status}>
                    <TestRowHeader>
                      <div>
                        <TestRowTitle>{test.title}</TestRowTitle>
                        <TestRowMeta>
                          {' '}&middot; {t('admin.importQuestions', { count: test.questionCount || 0 })}
                        </TestRowMeta>
                      </div>
                      <StatusBadge $status={status}>{getStatusLabel(status)}</StatusBadge>
                    </TestRowHeader>
                    {test.errors && test.errors.length > 0 && (
                      <ErrorList>
                        {test.errors.map((err, i) => (
                          <ErrorItem key={i}>{err}</ErrorItem>
                        ))}
                      </ErrorList>
                    )}
                    {test.duplicateWarnings && test.duplicateWarnings.length > 0 && (
                      test.duplicateWarnings.map((dup, i) => (
                        <DuplicateWarning key={i}>
                          {t('admin.duplicateScore', { score: Math.round(dup.similarity * 100) })}
                          {dup.existingTitle && ` — ${dup.existingTitle}`}
                        </DuplicateWarning>
                      ))
                    )}
                  </TestRow>
                );
              })}
            </PreviewTable>
          </PreviewSection>
        </>
      )}
    </div>
  );
}

export default AdminBulkImport;
