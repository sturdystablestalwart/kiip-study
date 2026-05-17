import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import useRequireAdmin from '../hooks/useRequireAdmin';
import { Button, Card, Badge, Modal, ModalActions } from '../components/ui';

const BackLink = styled(Button).attrs({ $variant: 'ghost', $size: 'compact' })`
  padding: 0;
  height: auto;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-weight: 400;
`;

const TitleInput = styled.input`
  width: 100%;
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  background: transparent;
  font-family: inherit;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
    background: ${({ theme }) => theme.colors.bg.surface};
  }
`;

const MetaRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[4]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const MetaInput = styled.input`
  flex: 1;
  height: ${({ theme }) => theme.layout.controlHeights.input}px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focus.shadow};
  }
`;

const DescTextarea = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  resize: vertical;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focus.shadow};
  }
`;

const QuestionCard = styled(Card)`
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const QuestionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const QuestionNum = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.text.faint};
`;

const MetaSelect = styled.select`
  height: ${({ theme }) => theme.layout.controlHeights.input}px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  background: ${({ theme }) => theme.colors.bg.surface};
  color: ${({ theme }) => theme.colors.text.primary};
  flex: 1;
  min-width: 0;
`;

const TypeSelect = styled.select`
  height: ${({ theme }) => theme.layout.controlHeights.compact}px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
`;

const DeleteQBtn = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  cursor: pointer;
  padding: ${({ theme }) => theme.layout.space[1]}px;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:hover { color: ${({ theme }) => theme.colors.state.danger}; }
`;

const QTextarea = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  resize: vertical;
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focus.shadow};
  }
`;

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[2]}px;
`;

const OptionCheck = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.accent.indigo};
`;

const OptionInput = styled.input`
  flex: 1;
  height: ${({ theme }) => theme.layout.controlHeights.compact}px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focus.shadow};
  }
`;

const SmallBtn = styled.button`
  padding: ${({ theme }) => theme.layout.space[1]}px ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: transparent;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: ${({ theme }) => theme.colors.state.danger}; color: ${({ theme }) => theme.colors.state.danger}; }
`;

const AddBtn = styled.button`
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px dashed ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: transparent;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  margin-top: ${({ theme }) => theme.layout.space[2]}px;
  &:hover { border-color: ${({ theme }) => theme.colors.accent.indigo}; color: ${({ theme }) => theme.colors.accent.indigo}; }
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const Chip = styled(Badge).attrs({ $color: 'indigo' })`
  padding: ${({ theme }) => theme.layout.space[1]}px ${({ theme }) => theme.layout.space[3]}px;
`;

const ChipRemove = styled.button`
  background: none;
  border: none;
  color: inherit;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:hover { opacity: 0.7; }
`;

const ExplanationInput = styled.textarea`
  width: 100%;
  min-height: 40px;
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.muted};
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  resize: vertical;
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focus.shadow};
  }
`;

const BottomBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${({ theme }) => theme.layout.space[6]}px;
  padding-top: ${({ theme }) => theme.layout.space[5]}px;
  border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.state.danger};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const SectionLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin-bottom: ${({ theme }) => theme.layout.space[1]}px;
`;

const BlankSection = styled.div`
  margin-bottom: ${({ theme }) => theme.layout.space[2]}px;
`;

const OrderNum = styled.span`
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  min-width: 20px;
`;

const ModalBody = styled.div`
  h3 { margin: 0 0 ${({ theme }) => theme.layout.space[4]}px 0; }
  p { color: ${({ theme }) => theme.colors.text.muted}; margin: 0 0 ${({ theme }) => theme.layout.space[2]}px 0; }
`;

// Issue #116 — labels now resolve through t() at render time so the
// editor follows the active UI language.  See `admin.editorQuestionType.*`.
const QUESTION_TYPE_KEYS = {
    'mcq-single': 'admin.editorQuestionType.mcqSingle',
    'mcq-multiple': 'admin.editorQuestionType.mcqMultiple',
    'short-answer': 'admin.editorQuestionType.shortAnswer',
    'ordering': 'admin.editorQuestionType.ordering',
    'fill-in-the-blank': 'admin.editorQuestionType.fillInTheBlank',
};
const QUESTION_TYPE_VALUES = Object.keys(QUESTION_TYPE_KEYS);

function AdminTestEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    // user is referenced indirectly via useRequireAdmin; authLoading is
    // kept available for any callers below that still want it.
    const { loading: authLoading } = useAuth();
    const adminReady = useRequireAdmin();
    const { t } = useTranslation();

    const [curriculum, setCurriculum] = useState([]);

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [level, setLevel] = useState('');
    const [unitNumber, setUnitNumber] = useState('');
    const [section, setSection] = useState('');
    const [contentType, setContentType] = useState('general');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [chipInputs, setChipInputs] = useState({});
    const [deleteQModal, setDeleteQModal] = useState({ show: false, idx: null });

    useEffect(() => {
        api.get('/api/curriculum').then(res => setCurriculum(res.data)).catch(() => {});
    }, []);

    useEffect(() => {
        // Issue #163 — shared admin gate handles redirect; only fetch
        // when adminReady is true.
        if (adminReady) {
            const controller = new AbortController();
            api.get(`/api/tests/${id}`, { signal: controller.signal })
                .then(res => {
                    const data = res.data;
                    setTitle(data.title || '');
                    setCategory(data.category || '');
                    setDescription(data.description || '');
                    setLevel(data.level || '');
                    setUnitNumber(data.unitNumber != null ? String(data.unitNumber) : '');
                    setSection(data.section || '');
                    setContentType(data.contentType || 'general');
                    // Normalize legacy questions so reads of acceptedAnswers/blanks/
                    // options/correctOrder never crash when fields are undefined
                    // (legacy LLM-generated, BulkImport, or pre-schema-additions data).
                    // See issue #115.
                    setQuestions((data.questions || []).map(q => ({
                        ...q,
                        acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
                        blanks: Array.isArray(q.blanks)
                            ? q.blanks.map(b => ({
                                ...b,
                                acceptedAnswers: Array.isArray(b?.acceptedAnswers) ? b.acceptedAnswers : [],
                            }))
                            : [],
                        options: Array.isArray(q.options) ? q.options : [],
                        correctOrder: Array.isArray(q.correctOrder) ? q.correctOrder : [],
                    })));
                })
                .catch(err => {
                    if (err.name === 'CanceledError') return;
                    setError(t('admin.editorError.loadFailed'));
                })
                .finally(() => setLoading(false));
            return () => controller.abort();
        }
        // Issue #116 — `t` is stable per i18next and only used in the
        // error branch; listing it would re-fire the fetch on language
        // switch which we don't want (current test data stays usable).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, adminReady]);

    const updateQuestion = (idx, updates) => {
        setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
    };

    const updateOption = (qIdx, oIdx, updates) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const options = (q.options || []).map((o, j) => j === oIdx ? { ...o, ...updates } : o);
            return { ...q, options };
        }));
    };

    const toggleCorrect = (qIdx, oIdx) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const options = (q.options || []).map((o, j) => {
                if (q.type === 'mcq-single') {
                    return { ...o, isCorrect: j === oIdx };
                }
                return j === oIdx ? { ...o, isCorrect: !o.isCorrect } : o;
            });
            return { ...q, options };
        }));
    };

    const addOption = (qIdx) => {
        setQuestions(prev => prev.map((q, i) =>
            i === qIdx ? { ...q, options: [...(q.options || []), { text: '', isCorrect: false }] } : q
        ));
    };

    const removeOption = (qIdx, oIdx) => {
        setQuestions(prev => prev.map((q, i) =>
            i === qIdx ? { ...q, options: (q.options || []).filter((_, j) => j !== oIdx) } : q
        ));
    };

    const addAcceptedAnswer = (qIdx, value) => {
        if (!value.trim()) return;
        setQuestions(prev => prev.map((q, i) =>
            i === qIdx ? { ...q, acceptedAnswers: [...(q.acceptedAnswers || []), value.trim()] } : q
        ));
        setChipInputs(prev => ({ ...prev, [qIdx]: '' }));
    };

    const removeAcceptedAnswer = (qIdx, aIdx) => {
        setQuestions(prev => prev.map((q, i) =>
            i === qIdx ? { ...q, acceptedAnswers: (q.acceptedAnswers || []).filter((_, j) => j !== aIdx) } : q
        ));
    };

    const changeType = (qIdx, newType) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const updated = { ...q, type: newType };
            if ((newType === 'mcq-single' || newType === 'mcq-multiple') && (!q.options || q.options.length === 0)) {
                updated.options = [
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false }
                ];
            }
            return updated;
        }));
    };

    const requestDeleteQuestion = (idx) => {
        // Issue #164 — commit any in-flight IME composition (Korean
        // Hangul, Japanese, Chinese) BEFORE the modal portal mounts
        // and steals focus.  Without the explicit blur, the
        // compositionend event doesn't fire and the half-typed jamo
        // is dropped.  We re-focus after the next microtask so the
        // visible cursor doesn't jump.
        if (
            document.activeElement &&
            typeof document.activeElement.blur === 'function' &&
            (document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA')
        ) {
            document.activeElement.blur();
        }
        setDeleteQModal({ show: true, idx });
    };

    const confirmDeleteQuestion = () => {
        setQuestions(prev => prev.filter((_, i) => i !== deleteQModal.idx));
        setDeleteQModal({ show: false, idx: null });
    };

    const cancelDeleteQuestion = () => {
        setDeleteQModal({ show: false, idx: null });
    };

    const addQuestion = () => {
        setQuestions(prev => [...prev, {
            text: '', type: 'mcq-single', explanation: '',
            options: [
                { text: '', isCorrect: false },
                { text: '', isCorrect: false },
                { text: '', isCorrect: false },
                { text: '', isCorrect: false }
            ],
            acceptedAnswers: [], correctOrder: [], blanks: []
        }]);
    };

    const handleSave = async () => {
        setError(null);
        if (!title.trim()) { setError(t('admin.editorError.titleRequired')); return; }
        if (questions.length === 0) { setError(t('admin.editorError.atLeastOneQuestion')); return; }
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const n = i + 1;
            if (!q.text.trim()) { setError(t('admin.editorError.questionNoText', { n })); return; }
            if ((q.type === 'mcq-single' || q.type === 'mcq-multiple') && (!q.options || q.options.length < 2)) {
                setError(t('admin.editorError.questionNeeds2Options', { n })); return;
            }
            if ((q.type === 'mcq-single' || q.type === 'mcq-multiple') && !q.options.some(o => o.isCorrect)) {
                setError(t('admin.editorError.questionNeedsCorrect', { n })); return;
            }
            if (q.type === 'short-answer' && (!q.acceptedAnswers || q.acceptedAnswers.length === 0)) {
                setError(t('admin.editorError.questionNeedsAcceptedAnswer', { n })); return;
            }
        }

        setSaving(true);
        try {
            await api.patch(`/api/admin/tests/${id}`, {
                title,
                category,
                description,
                level: level || undefined,
                unitNumber: unitNumber ? parseInt(unitNumber) : undefined,
                section: section || undefined,
                contentType,
                questions,
            });
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || t('admin.editorError.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) return null;

    return (
        <div>
            <BackLink onClick={() => navigate('/')}>&larr; {t('test.goHome')}</BackLink>

            <TitleInput value={title} onChange={e => setTitle(e.target.value)} placeholder={t('admin.editorPlaceholder.testTitle')} aria-label={t('admin.editorAria.testTitle')} />

            <MetaRow>
                <MetaInput value={category} onChange={e => setCategory(e.target.value)} placeholder={t('admin.editorPlaceholder.category')} aria-label={t('admin.editorAria.category')} />
            </MetaRow>

            <MetaRow>
                <label>{t('home.level')}</label>
                <MetaSelect value={level} onChange={e => { setLevel(e.target.value); setUnitNumber(''); setSection(''); }} aria-label={t('admin.editorAria.level')}>
                    <option value="">{t('home.allLevels')}</option>
                    {curriculum.map(c => (
                        <option key={c.level} value={c.level}>{c.levelName.ko} ({c.levelName.en})</option>
                    ))}
                </MetaSelect>
            </MetaRow>

            <MetaRow>
                <label>{t('home.unit')}</label>
                <MetaSelect value={unitNumber} onChange={e => setUnitNumber(e.target.value)} aria-label={t('admin.editorAria.unit')}>
                    <option value="">{t('home.allUnits')}</option>
                    {(curriculum.find(c => c.level === level)?.units || []).filter(u => !u.isReview).map(u => (
                        <option key={u.number} value={String(u.number)}>{u.number}과 — {u.titleKo}</option>
                    ))}
                </MetaSelect>
            </MetaRow>

            {level && level.startsWith('5') && (
                <MetaRow>
                    <label>{t('classification.section')}</label>
                    <MetaSelect value={section} onChange={e => setSection(e.target.value)} aria-label={t('admin.editorAria.section')}>
                        <option value="">—</option>
                        {[...new Set((curriculum.find(c => c.level === level)?.units || []).map(u => u.section).filter(Boolean))].map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </MetaSelect>
                </MetaRow>
            )}

            <MetaRow>
                <label>{t('classification.contentType')}</label>
                <MetaSelect value={contentType} onChange={e => setContentType(e.target.value)} aria-label={t('admin.editorAria.contentType')}>
                    <option value="general">{t('classification.general')}</option>
                    <option value="mock-exam">{t('classification.mockExam')}</option>
                    <option value="topic-drill">{t('classification.topicDrill')}</option>
                    <option value="vocabulary">{t('classification.vocabulary')}</option>
                    <option value="grammar">{t('classification.grammar')}</option>
                </MetaSelect>
            </MetaRow>

            <DescTextarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('admin.editorPlaceholder.description')} aria-label={t('admin.editorAria.description')} />

            {error && <ErrorMsg>{error}</ErrorMsg>}

            {questions.map((q, qIdx) => (
                <QuestionCard key={qIdx} data-testid="question-card">
                    <QuestionHeader>
                        <QuestionNum>Q{qIdx + 1}</QuestionNum>
                        <TypeSelect value={q.type || 'mcq-single'} onChange={e => changeType(qIdx, e.target.value)} aria-label={`${t('admin.questionType')} ${qIdx + 1}`}>
                            {QUESTION_TYPE_VALUES.map(value => (
                                <option key={value} value={value}>{t(QUESTION_TYPE_KEYS[value])}</option>
                            ))}
                        </TypeSelect>
                        <DeleteQBtn onClick={() => requestDeleteQuestion(qIdx)} aria-label={`${t('admin.removeQuestion')} ${qIdx + 1}`} data-testid="delete-question-btn">
                            &times;
                        </DeleteQBtn>
                    </QuestionHeader>

                    <QTextarea value={q.text} onChange={e => updateQuestion(qIdx, { text: e.target.value })} placeholder={t('admin.editorPlaceholder.questionText')} aria-label={`${t('admin.editorPlaceholder.questionText')} ${qIdx + 1}`} />

                    {(q.type === 'mcq-single' || q.type === 'mcq-multiple') && (
                        <>
                            <SectionLabel>{t('admin.editorSection.options')}</SectionLabel>
                            {(q.options || []).map((opt, oIdx) => (
                                <OptionRow key={oIdx}>
                                    <OptionCheck
                                        type={q.type === 'mcq-single' ? 'radio' : 'checkbox'}
                                        name={`q${qIdx}-correct`}
                                        checked={opt.isCorrect}
                                        onChange={() => toggleCorrect(qIdx, oIdx)}
                                    />
                                    <OptionInput value={opt.text} onChange={e => updateOption(qIdx, oIdx, { text: e.target.value })} placeholder={t('admin.editorPlaceholder.option', { n: oIdx + 1 })} />
                                    <SmallBtn onClick={() => removeOption(qIdx, oIdx)}>&times;</SmallBtn>
                                </OptionRow>
                            ))}
                            <AddBtn onClick={() => addOption(qIdx)}>{t('admin.editorAction.addOption')}</AddBtn>
                        </>
                    )}

                    {q.type === 'short-answer' && (
                        <>
                            <SectionLabel>{t('admin.editorSection.acceptedAnswers')}</SectionLabel>
                            <ChipRow>
                                {(q.acceptedAnswers || []).map((ans, aIdx) => (
                                    <Chip key={aIdx}>
                                        {ans}
                                        <ChipRemove onClick={() => removeAcceptedAnswer(qIdx, aIdx)}>&times;</ChipRemove>
                                    </Chip>
                                ))}
                            </ChipRow>
                            <OptionRow>
                                <OptionInput
                                    value={chipInputs[qIdx] || ''}
                                    onChange={e => setChipInputs(prev => ({ ...prev, [qIdx]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAcceptedAnswer(qIdx, chipInputs[qIdx] || ''); } }}
                                    placeholder={t('admin.editorPlaceholder.answerEnter')}
                                />
                                <SmallBtn onClick={() => addAcceptedAnswer(qIdx, chipInputs[qIdx] || '')}>{t('admin.editorAction.addAnswer')}</SmallBtn>
                            </OptionRow>
                        </>
                    )}

                    {q.type === 'ordering' && (
                        <>
                            <SectionLabel>{t('admin.editorSection.orderedItems')}</SectionLabel>
                            {(q.options || []).map((opt, oIdx) => (
                                <OptionRow key={oIdx}>
                                    <OrderNum>{oIdx + 1}.</OrderNum>
                                    <OptionInput value={opt.text} onChange={e => updateOption(qIdx, oIdx, { text: e.target.value })} placeholder={t('admin.editorPlaceholder.item', { n: oIdx + 1 })} />
                                    <SmallBtn onClick={() => removeOption(qIdx, oIdx)}>&times;</SmallBtn>
                                </OptionRow>
                            ))}
                            <AddBtn onClick={() => addOption(qIdx)}>{t('admin.editorAction.addItem')}</AddBtn>
                        </>
                    )}

                    {q.type === 'fill-in-the-blank' && (
                        <>
                            <SectionLabel>{t('admin.editorSection.fillBlankHint')}</SectionLabel>
                            {(q.blanks || []).map((blank, bIdx) => (
                                <BlankSection key={bIdx}>
                                    <SectionLabel>{t('admin.editorSection.blankAnswers', { n: bIdx + 1 })}</SectionLabel>
                                    <ChipRow>
                                        {(blank.acceptedAnswers || []).map((ans, aIdx) => (
                                            <Chip key={aIdx}>
                                                {ans}
                                                <ChipRemove onClick={() => {
                                                    setQuestions(prev => prev.map((q2, i) => {
                                                        if (i !== qIdx) return q2;
                                                        const blanks = (q2.blanks || []).map((b, j) => {
                                                            if (j !== bIdx) return b;
                                                            return { ...b, acceptedAnswers: (b.acceptedAnswers || []).filter((_, k) => k !== aIdx) };
                                                        });
                                                        return { ...q2, blanks };
                                                    }));
                                                }}>&times;</ChipRemove>
                                            </Chip>
                                        ))}
                                    </ChipRow>
                                    <OptionRow>
                                        <OptionInput
                                            value={chipInputs[`${qIdx}-blank-${bIdx}`] || ''}
                                            onChange={e => setChipInputs(prev => ({ ...prev, [`${qIdx}-blank-${bIdx}`]: e.target.value }))}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = chipInputs[`${qIdx}-blank-${bIdx}`]?.trim();
                                                    if (!val) return;
                                                    setQuestions(prev => prev.map((q2, i) => {
                                                        if (i !== qIdx) return q2;
                                                        const blanks = (q2.blanks || []).map((b, j) => {
                                                            if (j !== bIdx) return b;
                                                            return { ...b, acceptedAnswers: [...(b.acceptedAnswers || []), val] };
                                                        });
                                                        return { ...q2, blanks };
                                                    }));
                                                    setChipInputs(prev => ({ ...prev, [`${qIdx}-blank-${bIdx}`]: '' }));
                                                }
                                            }}
                                            placeholder={t('admin.editorPlaceholder.answerEnter')}
                                        />
                                    </OptionRow>
                                </BlankSection>
                            ))}
                            <AddBtn onClick={() => {
                                setQuestions(prev => prev.map((q2, i) =>
                                    i === qIdx ? { ...q2, blanks: [...(q2.blanks || []), { acceptedAnswers: [] }] } : q2
                                ));
                            }}>{t('admin.editorAction.addBlank')}</AddBtn>
                        </>
                    )}

                    <ExplanationInput value={q.explanation || ''} onChange={e => updateQuestion(qIdx, { explanation: e.target.value })} placeholder={t('admin.explanation')} />
                </QuestionCard>
            ))}

            <BottomBar>
                <AddBtn onClick={addQuestion}>+ {t('admin.addQuestion')}</AddBtn>
                <Button $variant="accent" onClick={handleSave} disabled={saving}>
                    {saving ? t('common.loading') : t('admin.save')}
                </Button>
            </BottomBar>

            {deleteQModal.show && (
                <Modal onClose={cancelDeleteQuestion} ariaLabel={t('admin.editorAria.deleteConfirm')}>
                    <ModalBody>
                        <h3>{t('admin.editorModal.title')}</h3>
                        <p>{t('admin.editorModal.body', { n: deleteQModal.idx + 1 })}</p>
                    </ModalBody>
                    <ModalActions>
                        <Button $variant="secondary" onClick={cancelDeleteQuestion}>{t('admin.editorAction.cancel')}</Button>
                        <Button $variant="danger" onClick={confirmDeleteQuestion}>{t('admin.editorAction.remove')}</Button>
                    </ModalActions>
                </Modal>
            )}
        </div>
    );
}

export default AdminTestEditor;
