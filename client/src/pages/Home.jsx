import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import API_BASE_URL from '../config/api';

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

/* ───────── Component ───────── */

function Home() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, testId: null, testTitle: '' });
  const [deleting, setDeleting] = useState(false);

  const fetchTests = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE_URL}/api/tests`, {
        timeout: 10000
      });
      setTests(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Could not reach the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

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

  if (loading) {
    return (
      <div>
        <PageHeader>
          <h1>Your Tests</h1>
        </PageHeader>
        <LoadingState>Loading your tests...</LoadingState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader>
        <h1>Your Tests</h1>
        <CreateButton to="/create">+ New Test</CreateButton>
      </PageHeader>

      {error && (
        <ErrorBanner>
          <span>{error}</span>
          <RetryButton onClick={fetchTests}>Try again</RetryButton>
        </ErrorBanner>
      )}

      {!error && tests.length === 0 && (
        <EmptyState>
          <h2>No tests yet</h2>
          <p>Create one to start practicing!</p>
          <CreateButton to="/create">Create a Test</CreateButton>
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
              <CardMeta>{test.questions?.length || 0} questions</CardMeta>
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

      {deleteModal.show && (
        <ModalOverlay onClick={cancelDelete}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <h3>Remove this test?</h3>
            <p>
              "{deleteModal.testTitle}" and its attempt history will be permanently removed.
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
