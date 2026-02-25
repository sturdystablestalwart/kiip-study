import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const BackLink = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
  &:hover { color: ${({ theme }) => theme.colors.text.primary}; }
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
`;

const QuestionCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  padding: ${({ theme }) => theme.layout.space[5]}px;
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
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.faint};
`;

const TypeSelect = styled.select`
  height: 36px;
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
  font-size: 18px;
  cursor: pointer;
  padding: ${({ theme }) => theme.layout.space[1]}px;
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
`;

const OptionInput = styled.input`
  flex: 1;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
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

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[1]}px;
  padding: ${({ theme }) => theme.layout.space[1]}px ${({ theme }) => theme.layout.space[3]}px;
  background: ${({ theme }) => theme.colors.state.infoBg};
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.accent.indigo};
`;

const ChipRemove = styled.button`
  background: none;
  border: none;
  color: inherit;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
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
`;

const BottomBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${({ theme }) => theme.layout.space[6]}px;
  padding-top: ${({ theme }) => theme.layout.space[5]}px;
  border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const SaveBtn = styled.button`
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[6]}px;
  background: ${({ theme }) => theme.colors.accent.indigo};
  color: #fff;
  border: none;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: 550;
  font-family: inherit;
  cursor: pointer;
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.5; cursor: default; }
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

const QUESTION_TYPES = [
    { value: 'mcq-single', label: 'MCQ (single)' },
    { value: 'mcq-multiple', label: 'MCQ (multiple)' },
    { value: 'short-answer', label: 'Short answer' },
    { value: 'ordering', label: 'Ordering' },
    { value: 'fill-in-the-blank', label: 'Fill in the blank' }
];

function AdminTestEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { t } = useTranslation();

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [level, setLevel] = useState('');
    const [unit, setUnit] = useState('');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [chipInputs, setChipInputs] = useState({});

    useEffect(() => {
        if (!authLoading && !user?.isAdmin) {
            navigate('/');
            return;
        }

        if (!authLoading && user?.isAdmin) {
            const controller = new AbortController();
            api.get(`/api/tests/${id}`, { signal: controller.signal })
                .then(res => {
                    const t = res.data;
                    setTitle(t.title || '');
                    setCategory(t.category || '');
                    setDescription(t.description || '');
                    setLevel(t.level || '');
                    setUnit(t.unit || '');
                    setQuestions(t.questions || []);
                })
                .catch(err => {
                    if (err.name === 'CanceledError') return;
                    setError('Failed to load test');
                })
                .finally(() => setLoading(false));
            return () => controller.abort();
        }
    }, [id, authLoading, user, navigate]);

    const updateQuestion = (idx, updates) => {
        setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
    };

    const updateOption = (qIdx, oIdx, updates) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const options = q.options.map((o, j) => j === oIdx ? { ...o, ...updates } : o);
            return { ...q, options };
        }));
    };

    const toggleCorrect = (qIdx, oIdx) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const options = q.options.map((o, j) => {
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
            i === qIdx ? { ...q, options: [...q.options, { text: '', isCorrect: false }] } : q
        ));
    };

    const removeOption = (qIdx, oIdx) => {
        setQuestions(prev => prev.map((q, i) =>
            i === qIdx ? { ...q, options: q.options.filter((_, j) => j !== oIdx) } : q
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
            i === qIdx ? { ...q, acceptedAnswers: q.acceptedAnswers.filter((_, j) => j !== aIdx) } : q
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

    const deleteQuestion = (idx) => {
        setQuestions(prev => prev.filter((_, i) => i !== idx));
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
        if (!title.trim()) { setError('Title is required'); return; }
        if (questions.length === 0) { setError('At least one question is required'); return; }
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) { setError(`Question ${i + 1} has no text`); return; }
            if ((q.type === 'mcq-single' || q.type === 'mcq-multiple') && (!q.options || q.options.length < 2)) {
                setError(`Question ${i + 1} needs at least 2 options`); return;
            }
            if ((q.type === 'mcq-single' || q.type === 'mcq-multiple') && !q.options.some(o => o.isCorrect)) {
                setError(`Question ${i + 1} needs at least one correct option`); return;
            }
            if (q.type === 'short-answer' && (!q.acceptedAnswers || q.acceptedAnswers.length === 0)) {
                setError(`Question ${i + 1} needs at least one accepted answer`); return;
            }
        }

        setSaving(true);
        try {
            await api.patch(`/api/admin/tests/${id}`, { title, category, description, level, unit, questions });
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) return null;

    return (
        <div>
            <BackLink onClick={() => navigate('/')}>&larr; {t('test.goHome')}</BackLink>

            <TitleInput value={title} onChange={e => setTitle(e.target.value)} placeholder="Test title" />

            <MetaRow>
                <MetaInput value={category} onChange={e => setCategory(e.target.value)} placeholder="Category" />
                <MetaInput value={level} onChange={e => setLevel(e.target.value)} placeholder="Level (e.g. Level 2)" />
                <MetaInput value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (e.g. Unit 5)" />
            </MetaRow>

            <DescTextarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" />

            {error && <ErrorMsg>{error}</ErrorMsg>}

            {questions.map((q, qIdx) => (
                <QuestionCard key={qIdx}>
                    <QuestionHeader>
                        <QuestionNum>Q{qIdx + 1}</QuestionNum>
                        <TypeSelect value={q.type || 'mcq-single'} onChange={e => changeType(qIdx, e.target.value)}>
                            {QUESTION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </TypeSelect>
                        <DeleteQBtn onClick={() => deleteQuestion(qIdx)} aria-label={`Delete question ${qIdx + 1}`}>
                            &times;
                        </DeleteQBtn>
                    </QuestionHeader>

                    <QTextarea value={q.text} onChange={e => updateQuestion(qIdx, { text: e.target.value })} placeholder="Question text" />

                    {(q.type === 'mcq-single' || q.type === 'mcq-multiple') && (
                        <>
                            <SectionLabel>Options (check = correct)</SectionLabel>
                            {(q.options || []).map((opt, oIdx) => (
                                <OptionRow key={oIdx}>
                                    <OptionCheck
                                        type={q.type === 'mcq-single' ? 'radio' : 'checkbox'}
                                        name={`q${qIdx}-correct`}
                                        checked={opt.isCorrect}
                                        onChange={() => toggleCorrect(qIdx, oIdx)}
                                    />
                                    <OptionInput value={opt.text} onChange={e => updateOption(qIdx, oIdx, { text: e.target.value })} placeholder={`Option ${oIdx + 1}`} />
                                    <SmallBtn onClick={() => removeOption(qIdx, oIdx)}>&times;</SmallBtn>
                                </OptionRow>
                            ))}
                            <AddBtn onClick={() => addOption(qIdx)}>+ Add option</AddBtn>
                        </>
                    )}

                    {q.type === 'short-answer' && (
                        <>
                            <SectionLabel>Accepted answers</SectionLabel>
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
                                    placeholder="Type answer and press Enter"
                                />
                                <SmallBtn onClick={() => addAcceptedAnswer(qIdx, chipInputs[qIdx] || '')}>Add</SmallBtn>
                            </OptionRow>
                        </>
                    )}

                    {q.type === 'ordering' && (
                        <>
                            <SectionLabel>Items (in correct order)</SectionLabel>
                            {(q.options || []).map((opt, oIdx) => (
                                <OptionRow key={oIdx}>
                                    <span style={{ color: '#7B8086', fontSize: 12, minWidth: 20 }}>{oIdx + 1}.</span>
                                    <OptionInput value={opt.text} onChange={e => updateOption(qIdx, oIdx, { text: e.target.value })} placeholder={`Item ${oIdx + 1}`} />
                                    <SmallBtn onClick={() => removeOption(qIdx, oIdx)}>&times;</SmallBtn>
                                </OptionRow>
                            ))}
                            <AddBtn onClick={() => addOption(qIdx)}>+ Add item</AddBtn>
                        </>
                    )}

                    {q.type === 'fill-in-the-blank' && (
                        <>
                            <SectionLabel>Use ___ in the question text to mark blanks. Add accepted answers for each blank below.</SectionLabel>
                            {(q.blanks || []).map((blank, bIdx) => (
                                <BlankSection key={bIdx}>
                                    <SectionLabel>Blank {bIdx + 1} answers</SectionLabel>
                                    <ChipRow>
                                        {(blank.acceptedAnswers || []).map((ans, aIdx) => (
                                            <Chip key={aIdx}>
                                                {ans}
                                                <ChipRemove onClick={() => {
                                                    setQuestions(prev => prev.map((q2, i) => {
                                                        if (i !== qIdx) return q2;
                                                        const blanks = q2.blanks.map((b, j) => {
                                                            if (j !== bIdx) return b;
                                                            return { ...b, acceptedAnswers: b.acceptedAnswers.filter((_, k) => k !== aIdx) };
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
                                                        const blanks = q2.blanks.map((b, j) => {
                                                            if (j !== bIdx) return b;
                                                            return { ...b, acceptedAnswers: [...b.acceptedAnswers, val] };
                                                        });
                                                        return { ...q2, blanks };
                                                    }));
                                                    setChipInputs(prev => ({ ...prev, [`${qIdx}-blank-${bIdx}`]: '' }));
                                                }
                                            }}
                                            placeholder="Type answer and press Enter"
                                        />
                                    </OptionRow>
                                </BlankSection>
                            ))}
                            <AddBtn onClick={() => {
                                setQuestions(prev => prev.map((q2, i) =>
                                    i === qIdx ? { ...q2, blanks: [...(q2.blanks || []), { acceptedAnswers: [] }] } : q2
                                ));
                            }}>+ Add blank</AddBtn>
                        </>
                    )}

                    <ExplanationInput value={q.explanation || ''} onChange={e => updateQuestion(qIdx, { explanation: e.target.value })} placeholder={t('admin.explanation')} />
                </QuestionCard>
            ))}

            <BottomBar>
                <AddBtn onClick={addQuestion}>+ {t('admin.addQuestion')}</AddBtn>
                <SaveBtn onClick={handleSave} disabled={saving}>
                    {saving ? t('common.loading') : t('admin.save')}
                </SaveBtn>
            </BottomBar>
        </div>
    );
}

export default AdminTestEditor;
