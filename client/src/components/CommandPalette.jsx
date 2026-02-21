import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { below } from '../theme/breakpoints';
import api from '../utils/api';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(31, 35, 40, 0.45);
  display: flex;
  justify-content: center;
  padding-top: 15vh;
  z-index: 2000;
`;

const Panel = styled.div`
  width: 90%;
  max-width: 560px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.md};
  overflow: hidden;
  max-height: 420px;
  display: flex;
  flex-direction: column;
  align-self: flex-start;

  ${below.mobile} {
    width: calc(100vw - 32px);
  }
`;

const SearchInput = styled.input`
  width: 100%;
  height: ${({ theme }) => theme.layout.controlHeights.input}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: transparent;

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.faint};
  }

  &:focus {
    outline: none;
  }
`;

const ResultsList = styled.div`
  overflow-y: auto;
  flex: 1;
`;

const ResultItem = styled.button`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[5]}px;
  border: none;
  background: ${({ $active, theme }) => $active ? theme.colors.selection.bg : 'transparent'};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.selection.bg};
  }
`;

const ResultTitle = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ResultMeta = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin-left: ${({ theme }) => theme.layout.space[3]}px;
  flex-shrink: 0;
`;

const EmptyMessage = styled.div`
  padding: ${({ theme }) => theme.layout.space[6]}px;
  text-align: center;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
`;

function CommandPalette({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(
          `/api/tests?q=${encodeURIComponent(query.trim())}&limit=10`,
          { timeout: 5000 }
        );
        setResults(res.data.tests || []);
        setActiveIndex(0);
      } catch (err) {
        console.error('Command palette search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const openResult = useCallback((test) => {
    onClose();
    navigate(`/test/${test._id}`);
  }, [navigate, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      openResult(results[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <SearchInput
          ref={inputRef}
          type="text"
          placeholder="Search tests..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <ResultsList>
          {loading && <EmptyMessage>Searching...</EmptyMessage>}
          {!loading && query && results.length === 0 && (
            <EmptyMessage>No tests found for &ldquo;{query}&rdquo;</EmptyMessage>
          )}
          {!loading && results.map((test, i) => (
            <ResultItem
              key={test._id}
              $active={i === activeIndex}
              onClick={() => openResult(test)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <ResultTitle>{test.title}</ResultTitle>
              <ResultMeta>
                {test.questionCount} qs
                {test.lastAttempt && ` · ${Math.round((test.lastAttempt.score / test.lastAttempt.totalQuestions) * 100)}%`}
              </ResultMeta>
            </ResultItem>
          ))}
          {!loading && !query && (
            <EmptyMessage>Type to search across all tests</EmptyMessage>
          )}
        </ResultsList>
      </Panel>
    </Overlay>
  );
}

export default CommandPalette;
