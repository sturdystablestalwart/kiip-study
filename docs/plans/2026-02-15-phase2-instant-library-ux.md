# Phase 2 — Instant Library UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Users can find any test quickly via Ctrl+P command palette, browse with cursor pagination and level/unit filters, see a dashboard with recent activity, and navigate the test-taking UI with keyboard shortcuts.

**Architecture:** Backend adds `level`/`unit` fields to Test schema with text + compound indexes, rewrites GET /api/tests as an aggregation pipeline with cursor pagination, text search, and $lookup for last attempts. Frontend adds a navbar search trigger, command palette modal, shortcuts modal, redesigned Home page with dashboard sections, and keyboard navigation in TestTaker.

**Tech Stack:** Mongoose 9 aggregation, React 19, styled-components 6, no new dependencies

---

### Task 1: Add level/unit fields and indexes to Test model

**Files:**
- Modify: `server/models/Test.js`

**Step 1: Add fields and indexes**

Replace the entire file content with:

```js
const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isCorrect: { type: Boolean, required: true, default: false }
});

const QuestionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    image: { type: String },
    options: [OptionSchema],
    explanation: { type: String },
    type: { type: String, default: 'multiple-choice' }
});

const TestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, default: 'General' },
    description: { type: String },
    level: { type: String },
    unit: { type: String },
    questions: [QuestionSchema],
    createdAt: { type: Date, default: Date.now }
});

// Full-text search index on title, category, description
TestSchema.index({ title: 'text', category: 'text', description: 'text' });

// Compound index for filtering + sorting
TestSchema.index({ level: 1, unit: 1, createdAt: -1 });

module.exports = mongoose.model('Test', TestSchema);
```

**Step 2: Verify server starts**

Run: `cd server && node -e "require('./models/Test'); console.log('Model OK')"`
Expected: `Model OK`

**Step 3: Commit**

```bash
git add server/models/Test.js
git commit -m "feat: add level/unit fields and search indexes to Test model"
```

---

### Task 2: Rewrite GET /api/tests with aggregation pipeline

**Files:**
- Modify: `server/routes/tests.js` (lines 181-192, the GET `/` handler)

**Step 1: Replace the GET `/` handler**

Find the existing handler (lines 181-192):
```js
router.get('/', async (req, res) => {
    try {
        const tests = await Test.find().lean();
        const testsWithAttempts = await Promise.all(tests.map(async (test) => {
            const lastAttempt = await Attempt.findOne({ testId: test._id }).sort({ createdAt: -1 });
            return { ...test, lastAttempt };
        }));
        res.json(testsWithAttempts);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tests: ' + err.message });
    }
});
```

Replace with:
```js
router.get('/', async (req, res) => {
    try {
        const { q, level, unit, cursor, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);

        // Build match stage
        const match = {};
        if (q && q.trim()) {
            match.$text = { $search: q.trim() };
        }
        if (level) match.level = level;
        if (unit) match.unit = unit;

        // Cursor pagination: fetch items older than cursor
        if (cursor) {
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(cursor)) {
                match._id = { $lt: new mongoose.Types.ObjectId(cursor) };
            }
        }

        // Build aggregation pipeline
        const pipeline = [
            { $match: match },
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: limit + 1 },
            // Exclude questions array from list response (save bandwidth)
            { $project: {
                title: 1, category: 1, description: 1, level: 1, unit: 1,
                createdAt: 1, questionCount: { $size: '$questions' }
            }},
            // Join last attempt per test
            { $lookup: {
                from: 'attempts',
                let: { testId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$testId', '$$testId'] } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 1 },
                    { $project: { score: 1, totalQuestions: 1, mode: 1, createdAt: 1 } }
                ],
                as: 'attempts'
            }},
            { $addFields: {
                lastAttempt: { $arrayElemAt: ['$attempts', 0] }
            }},
            { $project: { attempts: 0 } }
        ];

        const results = await Test.aggregate(pipeline);

        // Determine if there are more results
        const hasMore = results.length > limit;
        const tests = hasMore ? results.slice(0, limit) : results;
        const nextCursor = hasMore ? tests[tests.length - 1]._id : null;

        // Get total count (without pagination) for display
        const countPipeline = [{ $match: { ...match } }];
        delete countPipeline[0].$match._id; // Remove cursor filter for total
        countPipeline.push({ $count: 'total' });
        const countResult = await Test.aggregate(countPipeline);
        const total = countResult[0]?.total || 0;

        res.json({ tests, nextCursor, total });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tests: ' + err.message });
    }
});
```

**Step 2: Add a GET endpoint for recent attempts (dashboard data)**

Add this new route BEFORE the `GET /:id` route (after the new GET `/` handler):

```js
// GET recent attempts for dashboard
router.get('/recent-attempts', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);
        const attempts = await Attempt.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Attach test title to each attempt
        const testIds = [...new Set(attempts.map(a => a.testId.toString()))];
        const tests = await Test.find(
            { _id: { $in: testIds } },
            { title: 1, level: 1, unit: 1 }
        ).lean();
        const testMap = Object.fromEntries(tests.map(t => [t._id.toString(), t]));

        const enriched = attempts.map(a => ({
            ...a,
            test: testMap[a.testId.toString()] || { title: 'Deleted test' }
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch recent attempts: ' + err.message });
    }
});
```

**Step 3: Verify server starts and endpoint works**

Run: `cd server && node -e "require('./index')"`
Expected: Server starts without errors. Test with `curl http://localhost:5000/api/tests` — should return `{ tests: [...], nextCursor: ..., total: ... }`.

**Step 4: Commit**

```bash
git add server/routes/tests.js
git commit -m "feat: rewrite GET /api/tests with aggregation, cursor pagination, and search"
```

---

### Task 3: Update Home.jsx to handle new API response shape

**Files:**
- Modify: `client/src/pages/Home.jsx`

The API now returns `{ tests, nextCursor, total }` instead of a flat array. This task updates the fetch call and adds pagination state. The full Home redesign comes in Task 4.

**Step 1: Update fetchTests and add pagination state**

In the `Home` function component (line 254), update the state and fetch:

Replace the existing state and fetchTests:
```js
const [tests, setTests] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
```

With:
```js
const [tests, setTests] = useState([]);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [error, setError] = useState(null);
const [nextCursor, setNextCursor] = useState(null);
const [total, setTotal] = useState(0);
const [levelFilter, setLevelFilter] = useState('');
const [unitFilter, setUnitFilter] = useState('');
const [recentAttempts, setRecentAttempts] = useState([]);
```

Replace the existing `fetchTests`:
```js
const fetchTests = async (cursor = null, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (levelFilter) params.set('level', levelFilter);
      if (unitFilter) params.set('unit', unitFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '20');

      const res = await axios.get(`${API_BASE_URL}/api/tests?${params}`, {
        timeout: 10000
      });

      if (append) {
        setTests(prev => [...prev, ...res.data.tests]);
      } else {
        setTests(res.data.tests);
      }
      setNextCursor(res.data.nextCursor);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Could not reach the server');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
```

Update the `useEffect` to depend on filters:
```js
useEffect(() => {
    fetchTests();
  }, [levelFilter, unitFilter]);
```

Also add a `useEffect` to fetch recent attempts:
```js
useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/tests/recent-attempts?limit=5`, {
          timeout: 10000
        });
        setRecentAttempts(res.data);
      } catch (err) {
        console.error('Failed to fetch recent attempts:', err);
      }
    };
    fetchRecent();
  }, []);
```

Add a load-more handler:
```js
const handleLoadMore = () => {
    if (nextCursor) {
      fetchTests(nextCursor, true);
    }
  };
```

Update the card rendering to use `test.questionCount` instead of `test.questions?.length || 0`:
```jsx
<CardMeta>{test.questionCount} questions</CardMeta>
```

**Step 2: Verify client builds**

Run: `cd client && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add client/src/pages/Home.jsx
git commit -m "feat: update Home to use paginated API with filters and recent attempts"
```

---

### Task 4: Redesign Home page with dashboard sections

**Files:**
- Modify: `client/src/pages/Home.jsx` (add styled components + new JSX sections)
- Create: `client/src/components/FilterDropdown.jsx`

**Step 1: Create FilterDropdown component**

```jsx
import React from 'react';
import styled from 'styled-components';

const Select = styled.select`
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

function FilterDropdown({ label, value, options, onChange }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </Select>
  );
}

export default FilterDropdown;
```

**Step 2: Add dashboard styled components to Home.jsx**

Add these styled components AFTER the existing styled components (before the `Home` function):

```jsx
const DashboardSection = styled.section`
  margin-bottom: ${({ theme }) => theme.layout.space[7]}px;
`;

const SectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.layout.space[4]}px 0;
`;

const ContinueCard = styled(Link)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${({ theme }) => theme.colors.bg.surface};
  padding: ${({ theme }) => theme.layout.space[5]}px ${({ theme }) => theme.layout.space[6]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.accent.indigo}33;
  box-shadow: ${({ theme }) => theme.layout.shadow.sm};
  text-decoration: none;
  color: inherit;
  transition: transform ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease},
              box-shadow ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.layout.shadow.md};
  }
`;

const ContinueInfo = styled.div`
  flex: 1;
`;

const ContinueTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.layout.space[1]}px 0;
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
`;

const ContinueMeta = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
`;

const ContinueScore = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.accent.moss};
`;

const RecentRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  overflow-x: auto;
  padding-bottom: ${({ theme }) => theme.layout.space[2]}px;
`;

const RecentChip = styled(Link)`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  text-decoration: none;
  color: inherit;
  transition: transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    transform: translateY(-2px);
  }
`;

const RecentScore = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.accent.moss};
`;

const RecentLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin-top: 2px;
`;

const FilterBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const FilterGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[2]}px;
`;

const TestCount = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
`;

const LoadMoreButton = styled.button`
  display: block;
  width: 100%;
  max-width: 300px;
  margin: ${({ theme }) => theme.layout.space[6]}px auto 0;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.border.subtle};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
```

**Step 3: Rewrite the Home JSX return**

Replace the entire return block (starting from `return (`) with the redesigned layout:

```jsx
const lastAttempt = recentAttempts[0];
const scorePercent = lastAttempt
    ? Math.round((lastAttempt.score / lastAttempt.totalQuestions) * 100)
    : 0;

const LEVEL_OPTIONS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
const UNIT_OPTIONS = Array.from({ length: 20 }, (_, i) => `Unit ${i + 1}`);

return (
    <div>
      <PageHeader>
        <h1>Your Tests</h1>
        <CreateButton to="/create">+ New Test</CreateButton>
      </PageHeader>

      {error && (
        <ErrorBanner>
          <span>{error}</span>
          <RetryButton onClick={() => fetchTests()}>Try again</RetryButton>
        </ErrorBanner>
      )}

      {/* Continue Last Session */}
      {lastAttempt && (
        <DashboardSection>
          <ContinueCard to={`/test/${lastAttempt.testId}`}>
            <ContinueInfo>
              <ContinueTitle>{lastAttempt.test?.title || 'Test'}</ContinueTitle>
              <ContinueMeta>
                {lastAttempt.mode} mode &middot; {lastAttempt.score}/{lastAttempt.totalQuestions}
                {' '}&middot; {new Date(lastAttempt.createdAt).toLocaleDateString()}
              </ContinueMeta>
            </ContinueInfo>
            <ContinueScore>{scorePercent}%</ContinueScore>
          </ContinueCard>
        </DashboardSection>
      )}

      {/* Recent Attempts */}
      {recentAttempts.length > 1 && (
        <DashboardSection>
          <SectionTitle>Recent Attempts</SectionTitle>
          <RecentRow>
            {recentAttempts.map((attempt, i) => (
              <RecentChip key={attempt._id || i} to={`/test/${attempt.testId}`}>
                <RecentScore>
                  {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
                </RecentScore>
                <RecentLabel>
                  {attempt.test?.unit || attempt.test?.title?.slice(0, 8) || '...'}
                </RecentLabel>
              </RecentChip>
            ))}
          </RecentRow>
        </DashboardSection>
      )}

      {/* Filter Bar + Test Grid */}
      <FilterBar>
        <SectionTitle style={{ margin: 0 }}>All Tests</SectionTitle>
        <FilterGroup>
          <FilterDropdown
            label="Level"
            value={levelFilter}
            options={LEVEL_OPTIONS}
            onChange={setLevelFilter}
          />
          <FilterDropdown
            label="Unit"
            value={unitFilter}
            options={UNIT_OPTIONS}
            onChange={setUnitFilter}
          />
          {total > 0 && <TestCount>{total} tests</TestCount>}
        </FilterGroup>
      </FilterBar>

      {!loading && !error && tests.length === 0 && (
        <EmptyState>
          <h2>No tests found</h2>
          <p>{levelFilter || unitFilter ? 'Try different filters.' : 'Create one to start practicing!'}</p>
          {!levelFilter && !unitFilter && (
            <CreateButton to="/create">Create a Test</CreateButton>
          )}
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
              <CardMeta>{test.questionCount} questions</CardMeta>
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

      {nextCursor && (
        <LoadMoreButton onClick={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : 'Load more tests'}
        </LoadMoreButton>
      )}

      {/* Delete Modal (unchanged) */}
      {deleteModal.show && (
        <ModalOverlay onClick={cancelDelete}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <h3>Remove this test?</h3>
            <p>
              &ldquo;{deleteModal.testTitle}&rdquo; and its attempt history will be permanently removed.
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
```

Don't forget to add the import at the top of Home.jsx:
```js
import FilterDropdown from '../components/FilterDropdown';
```

**Step 4: Verify client builds**

Run: `cd client && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add client/src/pages/Home.jsx client/src/components/FilterDropdown.jsx
git commit -m "feat: redesign Home page with dashboard sections, filters, and load-more pagination"
```

---

### Task 5: Create CommandPalette component (Ctrl+P)

**Files:**
- Create: `client/src/components/CommandPalette.jsx`

**Step 1: Create the component**

```jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import API_BASE_URL from '../config/api';

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

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
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
        const res = await axios.get(
          `${API_BASE_URL}/api/tests?q=${encodeURIComponent(query.trim())}&limit=10`,
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
```

**Step 2: Verify client builds**

Run: `cd client && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add client/src/components/CommandPalette.jsx
git commit -m "feat: add CommandPalette component (Ctrl+P search)"
```

---

### Task 6: Create ShortcutsModal component (Ctrl+K)

**Files:**
- Create: `client/src/components/ShortcutsModal.jsx`

**Step 1: Create the component**

```jsx
import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(31, 35, 40, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Panel = styled.div`
  width: 90%;
  max-width: 400px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.md};
  padding: ${({ theme }) => theme.layout.space[6]}px;
`;

const Title = styled.h2`
  margin: 0 0 ${({ theme }) => theme.layout.space[5]}px 0;
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const ShortcutRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.layout.space[2]}px 0;

  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
  }
`;

const ShortcutLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const Kbd = styled.kbd`
  display: inline-block;
  padding: 2px ${({ theme }) => theme.layout.space[2]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const shortcuts = [
  { keys: 'Ctrl+P', label: 'Open command palette' },
  { keys: 'Ctrl+K', label: 'Show this panel' },
  { keys: '1 – 4', label: 'Select option (during test)' },
  { keys: '← →', label: 'Previous / next question' },
  { keys: 'Enter', label: 'Confirm action' },
  { keys: 'Esc', label: 'Close modal' },
];

function ShortcutsModal({ onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <Overlay onClick={onClose}>
      <Panel ref={panelRef} onClick={e => e.stopPropagation()}>
        <Title>Keyboard Shortcuts</Title>
        {shortcuts.map(({ keys, label }) => (
          <ShortcutRow key={keys}>
            <ShortcutLabel>{label}</ShortcutLabel>
            <Kbd>{keys}</Kbd>
          </ShortcutRow>
        ))}
      </Panel>
    </Overlay>
  );
}

export default ShortcutsModal;
```

**Step 2: Verify client builds**

Run: `cd client && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add client/src/components/ShortcutsModal.jsx
git commit -m "feat: add ShortcutsModal component (Ctrl+K)"
```

---

### Task 7: Add navbar search trigger + global keyboard listeners to App.jsx

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Add imports**

Add at the top of the file:
```js
import { useState, useEffect, useCallback } from 'react';
import CommandPalette from './components/CommandPalette';
import ShortcutsModal from './components/ShortcutsModal';
```

Update the existing React import to include what's needed (it currently imports only `React`):
```js
import React, { useState, useEffect, useCallback } from 'react';
```

**Step 2: Add NavSearchTrigger styled component**

Add after the existing `NavLinks` styled component (around line 45):

```jsx
const NavSearchTrigger = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  min-width: 200px;

  &:hover {
    border-color: ${({ theme }) => theme.colors.focus.ring};
    background: ${({ theme }) => theme.colors.bg.surface};
  }

  @media (max-width: 600px) {
    min-width: 140px;
  }
`;

const SearchIcon = styled.span`
  font-size: 14px;
  opacity: 0.5;
`;

const SearchHint = styled.span`
  margin-left: auto;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  opacity: 0.6;
`;
```

**Step 3: Update Navigation component**

Replace the `Navigation` function with:

```jsx
function Navigation({ onSearchClick }) {
  const location = useLocation();

  return (
    <Nav>
      <Logo to="/">KIIP Study</Logo>
      <NavSearchTrigger onClick={onSearchClick} aria-label="Search tests">
        <SearchIcon>&#128269;</SearchIcon>
        Search tests...
        <SearchHint>Ctrl+P</SearchHint>
      </NavSearchTrigger>
      <NavLinks>
        <NavLink to="/" active={location.pathname === '/' ? 1 : 0}>Tests</NavLink>
        <NavLink to="/create" active={location.pathname === '/create' ? 1 : 0}>New Test</NavLink>
      </NavLinks>
    </Nav>
  );
}
```

**Step 4: Update App component with modal state and keyboard listeners**

Replace the `App` function with:

```jsx
function App() {
  const [showPalette, setShowPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleGlobalKeyDown = useCallback((e) => {
    // Don't trigger shortcuts when typing in inputs
    const tag = e.target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      setShowPalette(prev => !prev);
      setShowShortcuts(false);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setShowShortcuts(prev => !prev);
      setShowPalette(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  return (
    <ThemeProvider theme={tokens}>
      <GlobalStyles />
      <Router>
        <AppShell>
          <Navigation onSearchClick={() => setShowPalette(true)} />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateTest />} />
            <Route path="/test/:id" element={<TestTaker />} />
          </Routes>
        </AppShell>
        {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </Router>
    </ThemeProvider>
  );
}
```

Note: The `CommandPalette` and `ShortcutsModal` are rendered **inside** the `Router` but **outside** `AppShell` so they overlay the full viewport. They need to be inside `Router` because `CommandPalette` uses `useNavigate`.

**Step 5: Verify client builds**

Run: `cd client && npm run build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: add navbar search trigger and global Ctrl+P/Ctrl+K listeners"
```

---

### Task 8: Add keyboard navigation to TestTaker

**Files:**
- Modify: `client/src/pages/TestTaker.jsx`

**Step 1: Add keyboard event handler**

Find the `handleBeforeUnload` useEffect (around line 476-479). Add a new useEffect right after it:

```jsx
// Keyboard shortcuts: 1-4 select options, arrow keys navigate, Enter submits
useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle if in a modal or submitted
      if (isSubmitted || showExitModal || showModeModal) return;
      // Don't handle if typing in an input
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (!test) return;
      const question = test.questions[currentQ];
      if (!question) return;

      // 1-4: select option
      const num = parseInt(e.key);
      if (num >= 1 && num <= question.options.length) {
        e.preventDefault();
        handleSelect(num - 1);
        return;
      }

      // Arrow right / left: navigate questions
      if (e.key === 'ArrowRight' && currentQ < test.questions.length - 1) {
        e.preventDefault();
        setCurrentQ(currentQ + 1);
      } else if (e.key === 'ArrowLeft' && currentQ > 0) {
        e.preventDefault();
        setCurrentQ(currentQ - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [test, currentQ, isSubmitted, showExitModal, showModeModal, handleSelect]);
```

Note: `handleSelect` must be wrapped with `useCallback` for this to work correctly. Find the existing `handleSelect` function and wrap it:

Replace:
```js
const handleSelect = (idx) => {
```

With:
```js
const handleSelect = useCallback((idx) => {
```

And close with:
```js
}, [isSubmitted, answers, currentQ, timerExpired]);
```

So the full replacement is:
```js
const handleSelect = useCallback((idx) => {
    if (isSubmitted) return;
    setAnswers({
      ...answers,
      [currentQ]: {
        index: idx,
        overdue: timerExpired
      }
    });
  }, [isSubmitted, answers, currentQ, timerExpired]);
```

**Step 2: Verify client builds**

Run: `cd client && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add client/src/pages/TestTaker.jsx
git commit -m "feat: add keyboard navigation to TestTaker (1-4 select, arrows navigate)"
```

---

### Task 9: Update IMPLEMENTATION_PLAN.md

**Files:**
- Modify: `IMPLEMENTATION_PLAN.md` (Phase 2 section, lines 91-117)

**Step 1: Mark Phase 2 complete**

Replace the Phase 2 section with:

```markdown
## Phase 2 — Instant Library UX ✅ COMPLETE

> Dashboard, search, Ctrl+P palette, Ctrl+K shortcuts, keyboard navigation.

**Goal:** Users can find any test quickly using search and Ctrl+P; keyboard shortcut list appears via Ctrl+K.

### Tasks (PR-sized)

- [x] **2.1** Home dashboard: "Continue last session" card + "Recent attempts" row
- [x] **2.2** Cursor pagination with "Load more" button (limit 20, max 50)
- [x] **2.3** Server-side search via `$text` index + level/unit filters + aggregation pipeline
- [x] **2.4** Ctrl+P command palette with debounced search and keyboard navigation (navbar trigger)
- [x] **2.5** Ctrl+K global shortcuts modal + keyboard navigation in TestTaker (1-4, arrows)

### API Changes

| Method | Endpoint | Change |
|--------|----------|--------|
| `GET` | `/api/tests?q=&level=&unit=&cursor=&limit=` | Aggregation pipeline, cursor pagination, text search |
| `GET` | `/api/tests/recent-attempts?limit=` | New — returns recent attempts with test metadata |

### Acceptance Criteria

- [x] Home page loads dashboard with continue/recent sections
- [x] Search returns results via Ctrl+P palette from any page
- [x] Level/Unit filter dropdowns narrow the test list
- [x] Ctrl+K shows shortcut reference
- [x] Keyboard-only navigation works (1-4 select, arrows navigate)
```

**Step 2: Commit**

```bash
git add IMPLEMENTATION_PLAN.md
git commit -m "docs: mark Phase 2 complete in implementation plan"
```

---

### Task 10: Final verification

**Step 1: Verify client build**

Run: `cd client && npm run build`
Expected: Build succeeds with no errors.

**Step 2: Verify lint**

Run: `cd client && npm run lint`
Expected: No errors.

**Step 3: Verify compose config**

Run: `docker compose config > /dev/null`
Expected: No errors.

**Step 4: Fix any issues and commit if needed**

```bash
git add -A
git commit -m "fix: address verification feedback"
```
