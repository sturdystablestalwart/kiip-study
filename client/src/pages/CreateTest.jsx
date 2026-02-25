import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';

/* ───────── Styled Components ───────── */

const Wrapper = styled.div`
  max-width: 640px;
  margin: 0 auto;
`;

const PageTitle = styled.h1`
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const SectionTitle = styled.h3`
  margin-bottom: ${({ theme }) => theme.layout.space[2]}px;
`;

const SectionHint = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  line-height: ${({ theme }) => theme.typography.scale.small.line}px;
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const Section = styled.div`
  margin-bottom: ${({ theme }) => theme.layout.space[7]}px;
  opacity: ${({ disabled }) => disabled ? 0.45 : 1};
  pointer-events: ${({ disabled }) => disabled ? 'none' : 'auto'};
  transition: opacity ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease};
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 200px;
  padding: ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ $hasError, theme }) => $hasError ? theme.colors.state.danger : theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-family: inherit;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  color: ${({ theme }) => theme.colors.text.primary};
  resize: vertical;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.faint};
  }

  &:focus {
    outline: none;
    border-color: ${({ $hasError, theme }) => $hasError ? theme.colors.state.danger : theme.colors.accent.indigo};
    box-shadow: 0 0 0 3px ${({ $hasError }) => $hasError ? 'rgba(180,58,58,0.12)' : 'rgba(42,83,109,0.12)'};
  }
`;

const CharCount = styled.div`
  text-align: right;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  line-height: ${({ theme }) => theme.typography.scale.micro.line}px;
  color: ${({ $hasError, theme }) => $hasError ? theme.colors.state.danger : theme.colors.text.faint};
  margin-top: ${({ theme }) => theme.layout.space[1]}px;
`;

const UploadZone = styled.div`
  margin-top: ${({ theme }) => theme.layout.space[5]}px;
  padding: ${({ theme }) => theme.layout.space[5]}px;
  border: 2px dashed ${({ $hasError, theme }) => $hasError ? theme.colors.state.danger : theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  text-align: center;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};

  p {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.scale.small.size}px;
    margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
  }
`;

const FileInput = styled.input`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};

  &::file-selector-button {
    height: 36px;
    padding: 0 ${({ theme }) => theme.layout.space[4]}px;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    border-radius: ${({ theme }) => theme.layout.radius.sm}px;
    background: ${({ theme }) => theme.colors.bg.surface};
    color: ${({ theme }) => theme.colors.text.primary};
    font-family: inherit;
    font-size: ${({ theme }) => theme.typography.scale.small.size}px;
    cursor: pointer;
    margin-right: ${({ theme }) => theme.layout.space[3]}px;
    transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

    &:hover {
      background: ${({ theme }) => theme.colors.selection.bg};
    }
  }
`;

const ImagePreviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: ${({ theme }) => theme.layout.space[3]}px;
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
`;

const PreviewImageContainer = styled.div`
  position: relative;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  overflow: hidden;
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
`;

const RemoveImageButton = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(31, 35, 40, 0.55);
  color: ${({ theme }) => theme.colors.bg.surface};
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.state.danger};
  }
`;

const ImageCount = styled.p`
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
`;

const UploadProgress = styled.div`
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
  color: ${({ theme }) => theme.colors.accent.indigo};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: ${({ theme }) => theme.layout.space[7]}px 0;
  color: ${({ theme }) => theme.colors.text.faint};

  &::before, &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
  }

  span {
    padding: 0 ${({ theme }) => theme.layout.space[4]}px;
    font-size: ${({ theme }) => theme.typography.scale.small.size}px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

const FileDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  padding: ${({ theme }) => theme.layout.space[4]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};

  span {
    flex: 1;
    font-size: ${({ theme }) => theme.typography.scale.small.size}px;
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

const ClearFileButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  cursor: pointer;
  font-size: 1.2rem;
  padding: 4px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.state.danger};
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  background: ${({ theme }) => theme.colors.accent.clay};
  color: ${({ theme }) => theme.colors.bg.surface};
  border: none;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover:not(:disabled) {
    background: #8B5340;
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.border.subtle};
    color: ${({ theme }) => theme.colors.text.faint};
    cursor: not-allowed;
  }
`;

const ErrorBanner = styled.div`
  background: ${({ theme }) => theme.colors.state.wrongBg};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  color: ${({ theme }) => theme.colors.state.danger};
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  line-height: ${({ theme }) => theme.typography.scale.small.line}px;
`;

const RateLimitBanner = styled.div`
  background: ${({ theme }) => theme.colors.state.infoBg};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  color: ${({ theme }) => theme.colors.state.warning};
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  line-height: ${({ theme }) => theme.typography.scale.small.line}px;
`;

const LoadingBox = styled.div`
  text-align: center;
  margin-top: ${({ theme }) => theme.layout.space[5]}px;
  padding: ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const LoadingTimer = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.accent.clay};
  margin-bottom: ${({ theme }) => theme.layout.space[2]}px;
  font-variant-numeric: tabular-nums;
`;

const LoadingPhrase = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  transition: opacity ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease};
`;

/* ───────── Component ───────── */

const MIN_TEXT_LENGTH = 200;
const MAX_TEXT_LENGTH = 50000;
const MAX_IMAGES = 20;

const LOADING_PHRASES = [
  'The AI is reading your material and crafting questions...',
  'Analyzing key concepts and vocabulary...',
  'Building answer choices that really test understanding...',
  'Almost like studying, but the AI does the hard part...',
  'Great material — this will make a solid practice test...',
  'Formatting questions and double-checking answers...',
  'Turning your notes into a real exam experience...',
  'A well-made test is worth a thousand flashcards...',
  'Polishing the final details — hang tight...',
];

function CreateTest() {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const timerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      setPhraseIndex(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          if (next % 20 === 0) {
            setPhraseIndex(pi => (pi + 1) % LOADING_PHRASES.length);
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [loading]);

  useEffect(() => {
    if (retryCountdown <= 0) return;
    retryTimerRef.current = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) { clearInterval(retryTimerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(retryTimerRef.current);
  }, [retryCountdown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const textLength = text.trim().length;
  const isTextValid = textLength >= MIN_TEXT_LENGTH && textLength <= MAX_TEXT_LENGTH;
  const canSubmit = (text.trim().length > 0 || file) && !loading && !uploadingImages && retryCountdown === 0;

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);

    if (images.length + files.length > MAX_IMAGES) {
      setUploadError(`You can add up to ${MAX_IMAGES - images.length} more images.`);
      return;
    }

    setUploadingImages(true);
    setUploadError(null);
    const uploadedUrls = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`"${file.name}" is too large (max 10 MB).`);
        continue;
      }

      const formData = new FormData();
      formData.append('image', file);
      try {
        const res = await api.post('/api/admin/tests/upload', formData, {
          timeout: 30000,
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedUrls.push(res.data.imageUrl);
      } catch (err) {
        console.error("Upload failed", err);
        setUploadError(err.response?.data?.message || `Could not upload "${file.name}".`);
      }
    }

    if (uploadedUrls.length > 0) {
      setImages([...images, ...uploadedUrls]);
    }
    setUploadingImages(false);
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const validateInput = () => {
    if (!text.trim() && !file) {
      setError('Please paste some text or upload a document to get started.');
      return false;
    }

    if (text.trim() && !file) {
      if (textLength < MIN_TEXT_LENGTH) {
        setError(`A bit more text is needed — at least ${MIN_TEXT_LENGTH} characters (currently ${textLength}).`);
        return false;
      }
      if (textLength > MAX_TEXT_LENGTH) {
        setError(`The text is too long — please keep it under ${MAX_TEXT_LENGTH.toLocaleString()} characters.`);
        return false;
      }
    }

    setError(null);
    return true;
  };

  const handleGenerate = async () => {
    if (!validateInput()) return;

    setLoading(true);
    setError(null);

    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        await api.post('/api/admin/tests/generate-from-file', formData, {
          timeout: 120000,
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        const fullText = images.length > 0
          ? `${text}\n\n[Images available: ${images.join(', ')}]`
          : text;
        await api.post('/api/admin/tests/generate', { text: fullText }, {
          timeout: 120000
        });
      }
      navigate('/');
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfter = parseInt(err.response.headers?.['retry-after']) || 60;
        setRetryCountdown(retryAfter);
        setError(null);
      } else {
        console.error(err);
        setError(err.response?.data?.message || 'Something went wrong while generating the test. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('This document is too large (max 10 MB).');
        e.target.value = '';
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const clearFile = () => {
    setFile(null);
  };

  const textHasError = text.trim().length > 0 && textLength < MIN_TEXT_LENGTH;

  return (
    <Wrapper>
      <PageTitle>{t('create.title')}</PageTitle>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {retryCountdown > 0 && (
        <RateLimitBanner>
          Rate limit reached — you can generate again in {retryCountdown}s
        </RateLimitBanner>
      )}

      <Section disabled={!!file}>
        <SectionTitle>{t('create.textLabel')}</SectionTitle>
        <SectionHint>
          {t('create.minChars', { min: MIN_TEXT_LENGTH })}
        </SectionHint>
        <TextArea
          placeholder={t('create.textPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!file}
          $hasError={textHasError}
        />
        <CharCount $hasError={textHasError}>
          {textLength.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}
          {textHasError && ` (${t('create.minChars', { min: MIN_TEXT_LENGTH - textLength })})`}
        </CharCount>

        <UploadZone $hasError={!!uploadError}>
          <p>{t('create.imagesHint', { max: MAX_IMAGES })}</p>
          <FileInput
            type="file"
            multiple
            onChange={handleImageUpload}
            accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/tiff"
            disabled={!!file || uploadingImages || images.length >= MAX_IMAGES}
          />
          {uploadingImages && <UploadProgress>Uploading...</UploadProgress>}
          {uploadError && <ErrorBanner style={{ marginTop: '8px' }}>{uploadError}</ErrorBanner>}
          <ImagePreviewGrid>
            {images.map((url, i) => (
              <PreviewImageContainer key={i}>
                <PreviewImage src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${url}`} alt={`Preview ${i + 1}`} />
                <RemoveImageButton onClick={() => removeImage(i)} aria-label="Remove image">&times;</RemoveImageButton>
              </PreviewImageContainer>
            ))}
          </ImagePreviewGrid>
          {images.length > 0 && (
            <ImageCount>{images.length} / {MAX_IMAGES} images</ImageCount>
          )}
        </UploadZone>
      </Section>

      <Divider><span>or</span></Divider>

      <Section disabled={text.trim().length > 0}>
        <SectionTitle>{t('create.fileLabel')}</SectionTitle>
        <SectionHint>
          {t('create.fileHint')}
        </SectionHint>
        {file ? (
          <FileDisplay>
            <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            <ClearFileButton onClick={clearFile} aria-label="Remove file">&times;</ClearFileButton>
          </FileDisplay>
        ) : (
          <FileInput
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.docx,.txt,.md"
            disabled={text.trim().length > 0}
          />
        )}
      </Section>

      <SubmitButton
        onClick={handleGenerate}
        disabled={!canSubmit || (text.trim().length > 0 && !isTextValid && !file)}
      >
        {loading ? t('create.generating') : t('create.generate')}
      </SubmitButton>

      {loading && (
        <LoadingBox>
          <LoadingTimer>
            {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
          </LoadingTimer>
          <LoadingPhrase>{LOADING_PHRASES[phraseIndex]}</LoadingPhrase>
        </LoadingBox>
      )}
    </Wrapper>
  );
}

export default CreateTest;
