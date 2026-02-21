# Phase 7 — Expansion Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 8 features (analytics dashboard, multi-language UI, mobile responsive, test sharing, bulk import, question dedup, dark theme, security hardening) to the KIIP Study platform.

**Architecture:** MERN stack (React 19, Express 5, Mongoose 9, styled-components v6). All new features follow existing patterns: styled-components with theme tokens, hooks-only state, Express route modules, Mongoose models. AnyChart for dashboards. react-i18next for i18n. Dark theme via dual token sets in ThemeProvider.

**Tech Stack:** anychart + anychart-react, react-i18next + i18next, nanoid, exceljs, papaparse, string-similarity, helmet, express-mongo-sanitize, hpp

**Design doc:** `docs/plans/2026-02-21-phase7-expansion-design.md`

---

## Task 1: Install All New Dependencies

**Files:**
- Modify: `client/package.json`
- Modify: `server/package.json`

**Step 1: Install server dependencies**

```bash
cd server && npm install helmet@8 express-mongo-sanitize@2 hpp@0.2.3 nanoid@5 exceljs@4 papaparse@5 string-similarity@4
```

**Step 2: Install client dependencies**

```bash
cd client && npm install anychart anychart-react react-i18next i18next i18next-browser-languagedetector
```

**Step 3: Verify both installs succeeded**

```bash
cd client && npm run build
cd server && node -e "require('helmet'); require('express-mongo-sanitize'); require('hpp'); console.log('OK')"
```

**Step 4: Commit**

```bash
git add client/package.json client/package-lock.json server/package.json server/package-lock.json
git commit -m "chore: install Phase 7 dependencies (anychart, i18next, helmet, nanoid, exceljs, papaparse, string-similarity)"
```

---

## Task 2: Security Hardening — Server Middleware

**Files:**
- Modify: `server/index.js` (lines 16-24 — middleware stack)

**Context:** Currently the middleware stack is: CORS → express.json → cookieParser → passport.initialize → static uploads. We need to add helmet, express-mongo-sanitize, and hpp BEFORE the route handlers.

**Step 1: Add security middleware to server/index.js**

Add imports at the top (after existing imports, around line 9):
```js
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
```

Add middleware after `app.use(express.json())` (after line 21):
```js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(mongoSanitize());
app.use(hpp());
```

**Step 2: Add production error sanitization**

At the bottom of `server/index.js`, before `app.listen`, add error handler:
```js
// Production error handler — strip stack traces
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  res.status(status).json({ error: message });
});
```

**Step 3: Verify server starts without errors**

```bash
cd server && node -e "require('./index.js')"
```
(Or start the full app with `npm start` and check console for errors.)

**Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: add security hardening (helmet, mongo-sanitize, hpp, error handler)"
```

---

## Task 3: Secrets Audit

**Files:**
- Verify: `.gitignore`
- Verify: no `.env` files in git history

**Step 1: Verify .gitignore includes sensitive patterns**

Read `.gitignore` and ensure these patterns exist:
```
.env
.env.*
server/.env
node_modules/
server/uploads/
```

Add any missing patterns.

**Step 2: Check for committed secrets**

```bash
git log --all --full-history -- "*.env" "**/.env" "**/credentials*" "**/secret*"
```

If any results, note them but do NOT rewrite history (destructive).

**Step 3: Verify current .env files are gitignored**

```bash
git status --porcelain | grep -i env
```

Should return empty (no .env tracked).

**Step 4: Commit if .gitignore was updated**

```bash
git add .gitignore
git commit -m "chore: verify .gitignore covers secrets and sensitive files"
```

---

## Task 4: Dark Theme — Token Architecture

**Files:**
- Modify: `client/src/theme/tokens.js` (71 lines — restructure colors)
- Create: `client/src/context/ThemeContext.jsx`
- Modify: `client/src/App.jsx` (line 226 — ThemeProvider)
- Modify: `client/src/theme/GlobalStyles.js` (line 23 — body bg)

**Context:** `tokens.js` currently exports a single `tokens` object. We need to split colors into light/dark variants and merge them into complete theme objects. The ThemeProvider in `App.jsx` (line 226) wraps the entire app — we need to make it dynamic.

**Step 1: Restructure tokens.js for dual themes**

Rewrite `client/src/theme/tokens.js`:
- Extract current colors into `lightColors` object
- Create `darkColors` object with dark palette
- Export `lightTheme` and `darkTheme` (each = shared tokens + respective colors)
- Keep backward compatibility: default export = lightTheme

```js
// Light palette (existing Japandi tokens)
const lightColors = {
  bg: { canvas: '#F7F2E8', surface: '#FFFFFF', surfaceAlt: '#FAF7F1' },
  border: { subtle: '#E6DDCF' },
  text: { primary: '#1F2328', muted: '#5B5F64', faint: '#7B8086' },
  accent: { clay: '#A0634A', moss: '#657655', indigo: '#2A536D' },
  state: {
    success: '#2F6B4F', warning: '#B07A2A', danger: '#B43A3A',
    infoBg: '#EEF3F5', correctBg: '#EEF5EF', wrongBg: '#F7EEEE',
  },
  focus: { ring: '#2A536D' },
  selection: { bg: '#F1E6D8' },
};

// Dark palette
const darkColors = {
  bg: { canvas: '#1A1A1A', surface: '#242424', surfaceAlt: '#2C2C2C' },
  border: { subtle: '#3A3A3A' },
  text: { primary: '#E8E4DC', muted: '#9A9A9A', faint: '#6A6A6A' },
  accent: { clay: '#C47A5E', moss: '#8A9B74', indigo: '#4A8BB0' },
  state: {
    success: '#4A9B6F', warning: '#D4A03A', danger: '#D45A5A',
    infoBg: '#1E2A2F', correctBg: '#1E2F1E', wrongBg: '#2F1E1E',
  },
  focus: { ring: '#4A8BB0' },
  selection: { bg: '#3A2E20' },
};

// Shared tokens (typography, layout, motion — no color changes)
const shared = {
  typography: { /* existing typography object */ },
  layout: { /* existing layout object */ },
  motion: { /* existing motion object */ },
};

export const lightTheme = { colors: lightColors, ...shared };
export const darkTheme = { colors: darkColors, ...shared };
const tokens = lightTheme; // backward compat
export default tokens;
```

**Step 2: Create ThemeContext**

Create `client/src/context/ThemeContext.jsx`:
```js
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { lightTheme, darkTheme } from '../theme/tokens';

const ThemeContext = createContext(null);

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'system');

  const prefersDark = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setMode(prev => prev === 'system' ? 'system' : prev);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  const theme = isDark ? darkTheme : lightTheme;

  const cycleMode = () => {
    const next = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    setMode(next);
    localStorage.setItem('theme', next);
  };

  return (
    <ThemeContext.Provider value={{ mode, isDark, cycleMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
```

**Step 3: Wire ThemeContext into App.jsx**

In `client/src/App.jsx`:
- Import `ThemeModeProvider` and `useThemeMode`
- Wrap app with `ThemeModeProvider` above `ThemeProvider`
- `ThemeProvider` reads from `useThemeMode().theme`
- Add theme toggle button in Navigation (sun/moon icon)

The Navigation component (lines 157-202) needs a theme toggle button between the language picker (added later) and auth section.

**Step 4: Update GlobalStyles.js**

In `client/src/theme/GlobalStyles.js` line 23-32 (body styling), the background and colors already reference `${({ theme }) => theme.colors.bg.canvas}` etc. — these will automatically switch when the theme object changes. Verify all hardcoded colors are replaced with theme references. The scrollbar styling (lines 121-136) should also use theme colors.

**Step 5: Verify build passes**

```bash
cd client && npm run build
```

**Step 6: Commit**

```bash
git add client/src/theme/tokens.js client/src/context/ThemeContext.jsx client/src/App.jsx client/src/theme/GlobalStyles.js
git commit -m "feat: add dark theme with system/light/dark toggle"
```

---

## Task 5: i18n Setup — Translation Infrastructure

**Files:**
- Create: `client/src/i18n/index.js`
- Create: `client/src/i18n/locales/en/common.json`
- Create: `client/src/i18n/locales/ko/common.json`
- Create: `client/src/i18n/locales/ru/common.json`
- Create: `client/src/i18n/locales/es/common.json`
- Modify: `client/src/main.jsx` (import i18n before App)

**Context:** `main.jsx` is the entry point that renders `<App />`. We need to import i18n config before App renders.

**Step 1: Create i18n configuration**

Create `client/src/i18n/index.js`:
```js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/common.json';
import ko from './locales/ko/common.json';
import ru from './locales/ru/common.json';
import es from './locales/es/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
      ru: { translation: ru },
      es: { translation: es },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

**Step 2: Create English translation file**

Create `client/src/i18n/locales/en/common.json` with all ~150 keys:
```json
{
  "nav": {
    "home": "Tests",
    "create": "New Test",
    "dashboard": "Dashboard",
    "flags": "Flags",
    "signIn": "Sign in",
    "signOut": "Sign out",
    "search": "Search...",
    "shortcuts": "Shortcuts"
  },
  "home": {
    "title": "Your Tests",
    "allTests": "All Tests",
    "loadMore": "Load more",
    "noTests": "No tests found",
    "createFirst": "Create a Test",
    "continueSession": "Resume In Progress",
    "recentAttempts": "Recent Attempts",
    "endlessPractice": "Endless Practice",
    "endlessDesc": "Practice random questions from the library without time limits.",
    "questionsCount": "{{count}} questions",
    "notAttempted": "Not attempted yet",
    "lastScore": "Last: {{score}}%",
    "showing": "Showing {{count}} tests",
    "level": "Level",
    "unit": "Unit",
    "allLevels": "All Levels",
    "allUnits": "All Units",
    "share": "Share",
    "linkCopied": "Link copied!",
    "downloadPdf": "Download PDF"
  },
  "test": {
    "practice": "Practice",
    "exam": "Test",
    "submit": "Submit",
    "next": "Next",
    "previous": "Previous",
    "question": "Question {{current}} of {{total}}",
    "timeLeft": "Time left",
    "overdue": "Overdue",
    "score": "Score",
    "correct": "Correct",
    "incorrect": "Incorrect",
    "reviewMissed": "Review Missed",
    "retake": "Retake",
    "goHome": "Back to Tests",
    "flagQuestion": "Flag Question",
    "confirmSubmit": "Submit your answers? You cannot change them afterwards.",
    "confirmExit": "You have unsaved progress. Leave anyway?",
    "confirmModeSwitch": "Switching modes will reset your progress. Continue?",
    "results": "Results",
    "duration": "Duration",
    "exportBlank": "Blank Test",
    "exportAnswerKey": "Answer Key",
    "exportMyAnswers": "My Answers",
    "exportReport": "Full Report"
  },
  "create": {
    "title": "Create Test",
    "textLabel": "Paste study material",
    "textPlaceholder": "Paste or type your study material here (200-50,000 characters)...",
    "fileLabel": "Or upload a document",
    "fileHint": "PDF, DOCX, TXT, or MD",
    "imagesLabel": "Add images (optional)",
    "imagesHint": "Up to {{max}} images",
    "generate": "Generate Test",
    "generating": "Preparing your test...",
    "charCount": "{{count}} characters",
    "minChars": "Minimum {{min}} characters required",
    "maxChars": "Maximum {{max}} characters"
  },
  "admin": {
    "editor": "Edit Test",
    "save": "Save Changes",
    "addQuestion": "Add Question",
    "removeQuestion": "Remove",
    "questionType": "Question Type",
    "options": "Options",
    "correctAnswer": "Correct Answer",
    "explanation": "Explanation",
    "flags": "Flags",
    "flagsOpen": "Open",
    "flagsResolved": "Resolved",
    "flagsDismissed": "Dismissed",
    "resolve": "Resolve",
    "dismiss": "Dismiss",
    "resolution": "Resolution note",
    "audit": "Audit Log",
    "import": "Bulk Import",
    "importUpload": "Upload Spreadsheet",
    "importPreview": "Preview Import",
    "importConfirm": "Confirm Import",
    "importTemplate": "Download Template",
    "duplicates": "Duplicates",
    "duplicateScore": "{{score}}% similar",
    "keepBoth": "Keep Both",
    "skip": "Skip"
  },
  "dashboard": {
    "title": "My Progress",
    "totalAttempts": "Total Attempts",
    "avgScore": "Average Score",
    "streak": "Current Streak",
    "weakestUnit": "Weakest Unit",
    "accuracyOverTime": "Accuracy Over Time",
    "scoreByUnit": "Score by Unit",
    "byQuestionType": "By Question Type",
    "period": "Time Period",
    "days7": "Last 7 days",
    "days30": "Last 30 days",
    "days90": "Last 90 days",
    "allTime": "All time",
    "noData": "Take some tests to see your progress here."
  },
  "endless": {
    "title": "Endless Practice",
    "start": "Start Practicing",
    "quit": "Quit",
    "questionsAnswered": "Questions Answered",
    "accuracy": "Accuracy",
    "filters": "Filters"
  },
  "common": {
    "loading": "Loading...",
    "error": "Something went wrong",
    "retry": "Try again",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "confirm": "Confirm",
    "close": "Close",
    "yes": "Yes",
    "no": "No",
    "or": "or",
    "of": "of",
    "days": "days"
  },
  "flag": {
    "title": "Flag this question",
    "reason": "Reason",
    "incorrectAnswer": "Incorrect answer",
    "unclearQuestion": "Unclear question",
    "typo": "Typo",
    "other": "Other",
    "note": "Additional details (optional)",
    "submit": "Submit Flag",
    "success": "Flag submitted. Thank you!"
  },
  "share": {
    "title": "Share Test",
    "copied": "Link copied to clipboard!",
    "publicLink": "Public Link"
  }
}
```

**Step 3: Create Korean translation file**

Create `client/src/i18n/locales/ko/common.json` — same structure, Korean values:
```json
{
  "nav": {
    "home": "시험",
    "create": "새 시험",
    "dashboard": "대시보드",
    "flags": "신고",
    "signIn": "로그인",
    "signOut": "로그아웃",
    "search": "검색...",
    "shortcuts": "단축키"
  },
  "home": {
    "title": "나의 시험",
    "allTests": "전체 시험",
    "loadMore": "더 보기",
    "noTests": "시험을 찾을 수 없습니다",
    "createFirst": "시험 만들기",
    "continueSession": "진행 중 이어하기",
    "recentAttempts": "최근 시도",
    "endlessPractice": "무한 연습",
    "endlessDesc": "시간 제한 없이 라이브러리에서 무작위 문제를 연습하세요.",
    "questionsCount": "{{count}}문제",
    "notAttempted": "아직 시도하지 않음",
    "lastScore": "최근: {{score}}%",
    "showing": "{{count}}개 시험 표시",
    "level": "단계",
    "unit": "단원",
    "allLevels": "모든 단계",
    "allUnits": "모든 단원",
    "share": "공유",
    "linkCopied": "링크가 복사되었습니다!",
    "downloadPdf": "PDF 다운로드"
  },
  "test": {
    "practice": "연습",
    "exam": "시험",
    "submit": "제출",
    "next": "다음",
    "previous": "이전",
    "question": "{{total}}문제 중 {{current}}번",
    "timeLeft": "남은 시간",
    "overdue": "초과",
    "score": "점수",
    "correct": "정답",
    "incorrect": "오답",
    "reviewMissed": "오답 복습",
    "retake": "다시 풀기",
    "goHome": "시험 목록으로",
    "flagQuestion": "문제 신고",
    "confirmSubmit": "답안을 제출하시겠습니까? 이후 변경할 수 없습니다.",
    "confirmExit": "저장하지 않은 진행 상황이 있습니다. 나가시겠습니까?",
    "confirmModeSwitch": "모드를 전환하면 진행 상황이 초기화됩니다. 계속하시겠습니까?",
    "results": "결과",
    "duration": "소요 시간",
    "exportBlank": "빈 시험지",
    "exportAnswerKey": "정답지",
    "exportMyAnswers": "내 답안",
    "exportReport": "전체 리포트"
  },
  "create": {
    "title": "시험 만들기",
    "textLabel": "학습 자료 붙여넣기",
    "textPlaceholder": "학습 자료를 여기에 붙여넣거나 입력하세요 (200-50,000자)...",
    "fileLabel": "또는 문서 업로드",
    "fileHint": "PDF, DOCX, TXT 또는 MD",
    "imagesLabel": "이미지 추가 (선택사항)",
    "imagesHint": "최대 {{max}}장",
    "generate": "시험 생성",
    "generating": "시험을 준비 중입니다...",
    "charCount": "{{count}}자",
    "minChars": "최소 {{min}}자 필요",
    "maxChars": "최대 {{max}}자"
  },
  "admin": {
    "editor": "시험 편집",
    "save": "저장",
    "addQuestion": "문제 추가",
    "removeQuestion": "삭제",
    "questionType": "문제 유형",
    "options": "선택지",
    "correctAnswer": "정답",
    "explanation": "해설",
    "flags": "신고",
    "flagsOpen": "처리 대기",
    "flagsResolved": "해결됨",
    "flagsDismissed": "반려됨",
    "resolve": "해결",
    "dismiss": "반려",
    "resolution": "처리 내용",
    "audit": "감사 로그",
    "import": "대량 가져오기",
    "importUpload": "스프레드시트 업로드",
    "importPreview": "가져오기 미리보기",
    "importConfirm": "가져오기 확인",
    "importTemplate": "템플릿 다운로드",
    "duplicates": "중복 문제",
    "duplicateScore": "{{score}}% 유사",
    "keepBoth": "모두 유지",
    "skip": "건너뛰기"
  },
  "dashboard": {
    "title": "나의 진행",
    "totalAttempts": "총 시도",
    "avgScore": "평균 점수",
    "streak": "연속 학습",
    "weakestUnit": "가장 약한 단원",
    "accuracyOverTime": "시간별 정확도",
    "scoreByUnit": "단원별 점수",
    "byQuestionType": "문제 유형별",
    "period": "기간",
    "days7": "최근 7일",
    "days30": "최근 30일",
    "days90": "최근 90일",
    "allTime": "전체",
    "noData": "시험을 풀고 여기에서 진행 상황을 확인하세요."
  },
  "endless": {
    "title": "무한 연습",
    "start": "연습 시작",
    "quit": "종료",
    "questionsAnswered": "답변한 문제",
    "accuracy": "정확도",
    "filters": "필터"
  },
  "common": {
    "loading": "로딩 중...",
    "error": "오류가 발생했습니다",
    "retry": "다시 시도",
    "cancel": "취소",
    "save": "저장",
    "delete": "삭제",
    "confirm": "확인",
    "close": "닫기",
    "yes": "네",
    "no": "아니오",
    "or": "또는",
    "of": "중",
    "days": "일"
  },
  "flag": {
    "title": "이 문제 신고하기",
    "reason": "사유",
    "incorrectAnswer": "정답이 틀림",
    "unclearQuestion": "문제가 불명확함",
    "typo": "오타",
    "other": "기타",
    "note": "추가 설명 (선택사항)",
    "submit": "신고 제출",
    "success": "신고가 제출되었습니다. 감사합니다!"
  },
  "share": {
    "title": "시험 공유",
    "copied": "링크가 클립보드에 복사되었습니다!",
    "publicLink": "공개 링크"
  }
}
```

**Step 4: Create Russian translation file**

Create `client/src/i18n/locales/ru/common.json`:
```json
{
  "nav": {
    "home": "Тесты",
    "create": "Новый тест",
    "dashboard": "Статистика",
    "flags": "Жалобы",
    "signIn": "Войти",
    "signOut": "Выйти",
    "search": "Поиск...",
    "shortcuts": "Горячие клавиши"
  },
  "home": {
    "title": "Ваши тесты",
    "allTests": "Все тесты",
    "loadMore": "Загрузить ещё",
    "noTests": "Тесты не найдены",
    "createFirst": "Создать тест",
    "continueSession": "Продолжить",
    "recentAttempts": "Последние попытки",
    "endlessPractice": "Бесконечная практика",
    "endlessDesc": "Решайте случайные вопросы из библиотеки без ограничения по времени.",
    "questionsCount": "{{count}} вопросов",
    "notAttempted": "Ещё не пройден",
    "lastScore": "Последний: {{score}}%",
    "showing": "Показано {{count}} тестов",
    "level": "Уровень",
    "unit": "Раздел",
    "allLevels": "Все уровни",
    "allUnits": "Все разделы",
    "share": "Поделиться",
    "linkCopied": "Ссылка скопирована!",
    "downloadPdf": "Скачать PDF"
  },
  "test": {
    "practice": "Практика",
    "exam": "Экзамен",
    "submit": "Отправить",
    "next": "Далее",
    "previous": "Назад",
    "question": "Вопрос {{current}} из {{total}}",
    "timeLeft": "Осталось",
    "overdue": "Просрочено",
    "score": "Результат",
    "correct": "Правильно",
    "incorrect": "Неправильно",
    "reviewMissed": "Работа над ошибками",
    "retake": "Пройти заново",
    "goHome": "К списку тестов",
    "flagQuestion": "Пожаловаться",
    "confirmSubmit": "Отправить ответы? Изменить их потом будет нельзя.",
    "confirmExit": "У вас есть несохранённый прогресс. Уйти?",
    "confirmModeSwitch": "Переключение режима сбросит прогресс. Продолжить?",
    "results": "Результаты",
    "duration": "Длительность",
    "exportBlank": "Чистый тест",
    "exportAnswerKey": "Ответы",
    "exportMyAnswers": "Мои ответы",
    "exportReport": "Полный отчёт"
  },
  "create": {
    "title": "Создать тест",
    "textLabel": "Вставьте учебный материал",
    "textPlaceholder": "Вставьте или введите учебный материал (200–50 000 символов)...",
    "fileLabel": "Или загрузите документ",
    "fileHint": "PDF, DOCX, TXT или MD",
    "imagesLabel": "Добавить изображения (необязательно)",
    "imagesHint": "До {{max}} изображений",
    "generate": "Создать тест",
    "generating": "Готовим ваш тест...",
    "charCount": "{{count}} символов",
    "minChars": "Минимум {{min}} символов",
    "maxChars": "Максимум {{max}} символов"
  },
  "admin": {
    "editor": "Редактор теста",
    "save": "Сохранить",
    "addQuestion": "Добавить вопрос",
    "removeQuestion": "Удалить",
    "questionType": "Тип вопроса",
    "options": "Варианты",
    "correctAnswer": "Правильный ответ",
    "explanation": "Объяснение",
    "flags": "Жалобы",
    "flagsOpen": "Открытые",
    "flagsResolved": "Решённые",
    "flagsDismissed": "Отклонённые",
    "resolve": "Решить",
    "dismiss": "Отклонить",
    "resolution": "Комментарий",
    "audit": "Журнал действий",
    "import": "Массовый импорт",
    "importUpload": "Загрузить таблицу",
    "importPreview": "Предпросмотр",
    "importConfirm": "Подтвердить импорт",
    "importTemplate": "Скачать шаблон",
    "duplicates": "Дубликаты",
    "duplicateScore": "{{score}}% совпадение",
    "keepBoth": "Оставить оба",
    "skip": "Пропустить"
  },
  "dashboard": {
    "title": "Мой прогресс",
    "totalAttempts": "Всего попыток",
    "avgScore": "Средний балл",
    "streak": "Серия дней",
    "weakestUnit": "Слабый раздел",
    "accuracyOverTime": "Точность по времени",
    "scoreByUnit": "Баллы по разделам",
    "byQuestionType": "По типу вопросов",
    "period": "Период",
    "days7": "7 дней",
    "days30": "30 дней",
    "days90": "90 дней",
    "allTime": "Всё время",
    "noData": "Пройдите тесты, чтобы увидеть свою статистику."
  },
  "endless": {
    "title": "Бесконечная практика",
    "start": "Начать",
    "quit": "Завершить",
    "questionsAnswered": "Отвечено вопросов",
    "accuracy": "Точность",
    "filters": "Фильтры"
  },
  "common": {
    "loading": "Загрузка...",
    "error": "Что-то пошло не так",
    "retry": "Попробовать снова",
    "cancel": "Отмена",
    "save": "Сохранить",
    "delete": "Удалить",
    "confirm": "Подтвердить",
    "close": "Закрыть",
    "yes": "Да",
    "no": "Нет",
    "or": "или",
    "of": "из",
    "days": "дней"
  },
  "flag": {
    "title": "Пожаловаться на вопрос",
    "reason": "Причина",
    "incorrectAnswer": "Неправильный ответ",
    "unclearQuestion": "Непонятный вопрос",
    "typo": "Опечатка",
    "other": "Другое",
    "note": "Дополнительно (необязательно)",
    "submit": "Отправить жалобу",
    "success": "Жалоба отправлена. Спасибо!"
  },
  "share": {
    "title": "Поделиться тестом",
    "copied": "Ссылка скопирована!",
    "publicLink": "Публичная ссылка"
  }
}
```

**Step 5: Create Spanish translation file**

Create `client/src/i18n/locales/es/common.json`:
```json
{
  "nav": {
    "home": "Pruebas",
    "create": "Nueva prueba",
    "dashboard": "Estadísticas",
    "flags": "Reportes",
    "signIn": "Iniciar sesión",
    "signOut": "Cerrar sesión",
    "search": "Buscar...",
    "shortcuts": "Atajos"
  },
  "home": {
    "title": "Tus pruebas",
    "allTests": "Todas las pruebas",
    "loadMore": "Cargar más",
    "noTests": "No se encontraron pruebas",
    "createFirst": "Crear una prueba",
    "continueSession": "Continuar en progreso",
    "recentAttempts": "Intentos recientes",
    "endlessPractice": "Práctica infinita",
    "endlessDesc": "Practica preguntas aleatorias de la biblioteca sin límite de tiempo.",
    "questionsCount": "{{count}} preguntas",
    "notAttempted": "Aún no intentado",
    "lastScore": "Último: {{score}}%",
    "showing": "Mostrando {{count}} pruebas",
    "level": "Nivel",
    "unit": "Unidad",
    "allLevels": "Todos los niveles",
    "allUnits": "Todas las unidades",
    "share": "Compartir",
    "linkCopied": "¡Enlace copiado!",
    "downloadPdf": "Descargar PDF"
  },
  "test": {
    "practice": "Práctica",
    "exam": "Examen",
    "submit": "Enviar",
    "next": "Siguiente",
    "previous": "Anterior",
    "question": "Pregunta {{current}} de {{total}}",
    "timeLeft": "Tiempo restante",
    "overdue": "Excedido",
    "score": "Puntuación",
    "correct": "Correcto",
    "incorrect": "Incorrecto",
    "reviewMissed": "Revisar errores",
    "retake": "Reintentar",
    "goHome": "Volver a pruebas",
    "flagQuestion": "Reportar pregunta",
    "confirmSubmit": "¿Enviar respuestas? No podrás cambiarlas después.",
    "confirmExit": "Tienes progreso sin guardar. ¿Salir de todos modos?",
    "confirmModeSwitch": "Cambiar de modo reiniciará tu progreso. ¿Continuar?",
    "results": "Resultados",
    "duration": "Duración",
    "exportBlank": "Prueba en blanco",
    "exportAnswerKey": "Clave de respuestas",
    "exportMyAnswers": "Mis respuestas",
    "exportReport": "Informe completo"
  },
  "create": {
    "title": "Crear prueba",
    "textLabel": "Pegar material de estudio",
    "textPlaceholder": "Pega o escribe tu material de estudio aquí (200-50.000 caracteres)...",
    "fileLabel": "O sube un documento",
    "fileHint": "PDF, DOCX, TXT o MD",
    "imagesLabel": "Agregar imágenes (opcional)",
    "imagesHint": "Hasta {{max}} imágenes",
    "generate": "Generar prueba",
    "generating": "Preparando tu prueba...",
    "charCount": "{{count}} caracteres",
    "minChars": "Mínimo {{min}} caracteres",
    "maxChars": "Máximo {{max}} caracteres"
  },
  "admin": {
    "editor": "Editor de prueba",
    "save": "Guardar",
    "addQuestion": "Agregar pregunta",
    "removeQuestion": "Eliminar",
    "questionType": "Tipo de pregunta",
    "options": "Opciones",
    "correctAnswer": "Respuesta correcta",
    "explanation": "Explicación",
    "flags": "Reportes",
    "flagsOpen": "Abiertos",
    "flagsResolved": "Resueltos",
    "flagsDismissed": "Descartados",
    "resolve": "Resolver",
    "dismiss": "Descartar",
    "resolution": "Nota de resolución",
    "audit": "Registro de auditoría",
    "import": "Importación masiva",
    "importUpload": "Subir hoja de cálculo",
    "importPreview": "Vista previa",
    "importConfirm": "Confirmar importación",
    "importTemplate": "Descargar plantilla",
    "duplicates": "Duplicados",
    "duplicateScore": "{{score}}% similar",
    "keepBoth": "Mantener ambos",
    "skip": "Omitir"
  },
  "dashboard": {
    "title": "Mi progreso",
    "totalAttempts": "Total de intentos",
    "avgScore": "Promedio",
    "streak": "Racha actual",
    "weakestUnit": "Unidad más débil",
    "accuracyOverTime": "Precisión en el tiempo",
    "scoreByUnit": "Puntuación por unidad",
    "byQuestionType": "Por tipo de pregunta",
    "period": "Período",
    "days7": "Últimos 7 días",
    "days30": "Últimos 30 días",
    "days90": "Últimos 90 días",
    "allTime": "Todo el tiempo",
    "noData": "Haz pruebas para ver tu progreso aquí."
  },
  "endless": {
    "title": "Práctica infinita",
    "start": "Comenzar",
    "quit": "Salir",
    "questionsAnswered": "Preguntas respondidas",
    "accuracy": "Precisión",
    "filters": "Filtros"
  },
  "common": {
    "loading": "Cargando...",
    "error": "Algo salió mal",
    "retry": "Reintentar",
    "cancel": "Cancelar",
    "save": "Guardar",
    "delete": "Eliminar",
    "confirm": "Confirmar",
    "close": "Cerrar",
    "yes": "Sí",
    "no": "No",
    "or": "o",
    "of": "de",
    "days": "días"
  },
  "flag": {
    "title": "Reportar esta pregunta",
    "reason": "Motivo",
    "incorrectAnswer": "Respuesta incorrecta",
    "unclearQuestion": "Pregunta confusa",
    "typo": "Error tipográfico",
    "other": "Otro",
    "note": "Detalles adicionales (opcional)",
    "submit": "Enviar reporte",
    "success": "Reporte enviado. ¡Gracias!"
  },
  "share": {
    "title": "Compartir prueba",
    "copied": "¡Enlace copiado al portapapeles!",
    "publicLink": "Enlace público"
  }
}
```

**Step 6: Import i18n in main.jsx**

In `client/src/main.jsx`, add import at the top (before App import):
```js
import './i18n/index';
```

**Step 7: Add language picker to App.jsx navbar**

In the Navigation component in `App.jsx` (around line 157-202), add a language dropdown between the nav links and auth section. Use `useTranslation` hook:

```js
import { useTranslation } from 'react-i18next';

// Inside Navigation component:
const { t, i18n } = useTranslation();
const languages = [
  { code: 'en', label: 'EN' },
  { code: 'ko', label: '한국어' },
  { code: 'ru', label: 'РУ' },
  { code: 'es', label: 'ES' },
];
```

Add a styled `LangButton` that cycles through languages or a small dropdown.

**Step 8: Translate Home.jsx static text**

Replace all hardcoded English strings in `client/src/pages/Home.jsx` with `t('key')` calls. Example:
- `"Your Tests"` → `{t('home.title')}`
- `"Load more"` → `{t('home.loadMore')}`
- `"All Tests"` → `{t('home.allTests')}`

**Step 9: Translate remaining pages**

Apply `useTranslation()` + `t()` calls to:
- `client/src/pages/TestTaker.jsx`
- `client/src/pages/CreateTest.jsx`
- `client/src/pages/EndlessMode.jsx`
- `client/src/pages/AdminTestEditor.jsx`
- `client/src/pages/AdminFlags.jsx`
- `client/src/components/CommandPalette.jsx`
- `client/src/components/ShortcutsModal.jsx`

**Step 10: Verify build passes**

```bash
cd client && npm run build
```

**Step 11: Commit**

```bash
git add client/src/i18n/ client/src/main.jsx client/src/App.jsx client/src/pages/ client/src/components/
git commit -m "feat: add multi-language UI (EN/KO/RU/ES) with react-i18next"
```

---

## Task 6: Mobile Responsive — Breakpoint System & Layout Polish

**Files:**
- Create: `client/src/theme/breakpoints.js`
- Modify: `client/src/theme/tokens.js` (add breakpoints to shared tokens)
- Modify: `client/src/App.jsx` (responsive nav)
- Modify: `client/src/pages/Home.jsx` (responsive grid, padding)
- Modify: `client/src/pages/TestTaker.jsx` (bottom sticky controls on mobile)
- Modify: `client/src/pages/CreateTest.jsx` (responsive padding)
- Modify: `client/src/pages/EndlessMode.jsx` (responsive)
- Modify: `client/src/components/CommandPalette.jsx` (full-width on mobile)

**Step 1: Create breakpoints helper**

Create `client/src/theme/breakpoints.js`:
```js
const sizes = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
};

export const below = Object.fromEntries(
  Object.entries(sizes).map(([key, value]) => [
    key,
    `@media (max-width: ${value}px)`,
  ])
);

export default sizes;
```

**Step 2: Add breakpoints to theme tokens**

In `client/src/theme/tokens.js`, add to the shared object:
```js
breakpoints: { mobile: 480, tablet: 768, laptop: 1024 },
```

**Step 3: Apply responsive patterns to App shell**

In `client/src/App.jsx`, update the AppShell styled component:
```js
import { below } from '../theme/breakpoints';

const AppShell = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.layout.space[8]}px ${({ theme }) => theme.layout.space[5]}px;

  ${below.tablet} {
    padding: ${({ theme }) => theme.layout.space[6]}px ${({ theme }) => theme.layout.space[4]}px;
  }

  ${below.mobile} {
    padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[3]}px;
  }
`;
```

Make nav responsive: hide search input text on mobile (show icon only), stack nav links.

**Step 4: Make Home.jsx grid responsive**

Update Grid styled component:
```js
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.layout.space[5]}px;

  ${below.mobile} {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.layout.space[4]}px;
  }
`;
```

**Step 5: TestTaker — bottom sticky controls on mobile**

In `client/src/pages/TestTaker.jsx`, make the navigation controls (Previous/Next/Submit) stick to the bottom on mobile:
```js
const Controls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  justify-content: space-between;

  ${below.mobile} {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: ${({ theme }) => theme.layout.space[3]}px;
    background: ${({ theme }) => theme.colors.bg.surface};
    border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
    z-index: 100;
  }
`;
```

Add bottom padding to the test content area so it doesn't get hidden behind sticky controls.

**Step 6: CommandPalette — full-width on mobile**

In `client/src/components/CommandPalette.jsx`, update the modal width:
```js
const PaletteBox = styled.div`
  width: 560px;
  max-height: 420px;

  ${below.mobile} {
    width: calc(100vw - 32px);
  }
`;
```

**Step 7: Verify build and visually test**

```bash
cd client && npm run build
```

Test at 480px and 768px viewport widths using browser dev tools.

**Step 8: Commit**

```bash
git add client/src/theme/breakpoints.js client/src/theme/tokens.js client/src/App.jsx client/src/pages/ client/src/components/
git commit -m "feat: add mobile responsive breakpoints and layout polish"
```

---

## Task 7: User Preferences API

**Files:**
- Modify: `server/models/User.js` (add preferences field)
- Modify: `server/routes/auth.js` (add PATCH /preferences endpoint)

**Step 1: Add preferences to User schema**

In `server/models/User.js` (12 lines total), add to the schema:
```js
preferences: {
  language: { type: String, enum: ['en', 'ko', 'ru', 'es'], default: 'en' },
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
},
```

**Step 2: Add preferences endpoint**

In `server/routes/auth.js`, add a new route:
```js
router.patch('/preferences', requireAuth, async (req, res) => {
  const { language, theme } = req.body;
  const updates = {};
  if (language && ['en', 'ko', 'ru', 'es'].includes(language)) {
    updates['preferences.language'] = language;
  }
  if (theme && ['light', 'dark', 'system'].includes(theme)) {
    updates['preferences.theme'] = theme;
  }
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
  res.json({ preferences: user.preferences });
});
```

**Step 3: Update GET /me to include preferences**

Ensure the `/api/auth/me` response includes `preferences`.

**Step 4: Commit**

```bash
git add server/models/User.js server/routes/auth.js
git commit -m "feat: add user preferences API (language, theme)"
```

---

## Task 8: Stats API — Analytics Aggregation Endpoints

**Files:**
- Create: `server/routes/stats.js`
- Modify: `server/index.js` (mount stats routes)

**Step 1: Create stats routes**

Create `server/routes/stats.js`:
```js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Attempt = require('../models/Attempt');
const mongoose = require('mongoose');

// GET /api/stats — KPIs + accuracy trend + unit breakdown
router.get('/', requireAuth, async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);
  const { period, level } = req.query;

  // Date filter
  let dateFilter = {};
  if (period === '7d') dateFilter = { createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } };
  else if (period === '30d') dateFilter = { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } };
  else if (period === '90d') dateFilter = { createdAt: { $gte: new Date(Date.now() - 90 * 86400000) } };

  const matchStage = { userId, ...dateFilter };

  // KPIs
  const [kpiResult] = await Attempt.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        totalCorrect: { $sum: '$score' },
        totalQuestions: { $sum: '$totalQuestions' },
      },
    },
  ]);

  const kpis = kpiResult
    ? {
        totalAttempts: kpiResult.totalAttempts,
        averageScore: kpiResult.totalQuestions > 0
          ? Math.round((kpiResult.totalCorrect / kpiResult.totalQuestions) * 1000) / 10
          : 0,
      }
    : { totalAttempts: 0, averageScore: 0 };

  // Streak — consecutive days with attempts
  const dayBuckets = await Attempt.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < dayBuckets.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (dayBuckets[i]._id === expectedStr) {
      streak++;
    } else {
      break;
    }
  }
  kpis.currentStreak = streak;

  // Accuracy trend (by day)
  const accuracyTrend = await Attempt.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        totalCorrect: { $sum: '$score' },
        totalQuestions: { $sum: '$totalQuestions' },
        attempts: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        score: {
          $round: [{ $multiply: [{ $divide: ['$totalCorrect', '$totalQuestions'] }, 100] }, 1],
        },
        attempts: 1,
        _id: 0,
      },
    },
  ]);

  // Unit breakdown (join with Test to get unit)
  const unitBreakdown = await Attempt.aggregate([
    { $match: { ...matchStage, testId: { $exists: true, $ne: null } } },
    { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
    { $unwind: '$test' },
    ...(level ? [{ $match: { 'test.level': level } }] : []),
    {
      $group: {
        _id: '$test.unit',
        totalCorrect: { $sum: '$score' },
        totalQuestions: { $sum: '$totalQuestions' },
        attempts: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        unit: '$_id',
        avgScore: {
          $round: [{ $multiply: [{ $divide: ['$totalCorrect', '$totalQuestions'] }, 100] }, 1],
        },
        attempts: 1,
        _id: 0,
      },
    },
  ]);

  // Weakest unit
  const weakest = unitBreakdown.length > 0
    ? unitBreakdown.reduce((min, u) => (u.avgScore < min.avgScore ? u : min))
    : null;
  kpis.weakestUnit = weakest ? { unit: weakest.unit, avgScore: weakest.avgScore } : null;

  res.json({ kpis, accuracyTrend, unitBreakdown });
});

// GET /api/stats/question-types — accuracy by question type
router.get('/question-types', requireAuth, async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);

  const result = await Attempt.aggregate([
    { $match: { userId } },
    { $unwind: '$answers' },
    { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
    { $unwind: { path: '$test', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        questionType: {
          $ifNull: [
            { $arrayElemAt: ['$test.questions.type', '$answers.questionIndex'] },
            'mcq-single',
          ],
        },
      },
    },
    {
      $group: {
        _id: '$questionType',
        correct: { $sum: { $cond: ['$answers.isCorrect', 1, 0] } },
        total: { $sum: 1 },
      },
    },
    {
      $project: {
        type: '$_id',
        correct: 1,
        total: 1,
        accuracy: {
          $round: [{ $multiply: [{ $divide: ['$correct', '$total'] }, 100] }, 1],
        },
        _id: 0,
      },
    },
    { $sort: { type: 1 } },
  ]);

  res.json({ types: result });
});

module.exports = router;
```

**Step 2: Mount in server/index.js**

Add after the existing route mounts (around line 69):
```js
const statsRoutes = require('./routes/stats');
app.use('/api/stats', statsRoutes);
```

**Step 3: Commit**

```bash
git add server/routes/stats.js server/index.js
git commit -m "feat: add stats API with KPIs, accuracy trend, unit breakdown, question-type accuracy"
```

---

## Task 9: Analytics Dashboard Page (AnyChart)

**Files:**
- Create: `client/src/pages/Dashboard.jsx`
- Modify: `client/src/App.jsx` (add route + nav link)

**Context:** AnyChart uses imperative API. The `anychart-react` wrapper provides a React component but we may need direct container refs for complex dashboards. Use `useEffect` with refs for chart lifecycle.

**Step 1: Create Dashboard page**

Create `client/src/pages/Dashboard.jsx`:
- Import `anychart` and `anychart-react`
- Fetch data from `GET /api/stats` and `GET /api/stats/question-types`
- 4 KPI cards at top (styled-components, using theme tokens)
- Line chart: accuracy over time (AnyChart `anychart.line()`)
- Bar chart: score by unit (AnyChart `anychart.bar()`)
- Radar chart: question type accuracy (AnyChart `anychart.radar()`)
- Filter dropdown: period (7d, 30d, 90d, all)
- Loading and empty states
- Use `useTranslation()` for all text
- Apply dark theme colors to AnyChart via `anychart.theme()` when isDark
- Use `React.lazy()` is NOT needed here since the page itself is the lazy boundary

Charts should be created in `useEffect` with cleanup (`.dispose()`):
```js
useEffect(() => {
  if (!trendData.length) return;
  const chart = anychart.line();
  chart.data(trendData.map(d => [d.date, d.score]));
  chart.title(t('dashboard.accuracyOverTime'));
  // Apply theme colors
  chart.background().fill(theme.colors.bg.surface);
  chart.container(trendRef.current);
  chart.draw();
  return () => chart.dispose();
}, [trendData, isDark]);
```

**Step 2: Add route and nav link**

In `client/src/App.jsx`:
- Add lazy import: `const Dashboard = React.lazy(() => import('./pages/Dashboard'));`
- Add route: `<Route path="/dashboard" element={<Suspense fallback={<div>{t('common.loading')}</div>}><Dashboard /></Suspense>} />`
- Add nav link in Navigation (only shown when user is logged in)

**Step 3: Verify build**

```bash
cd client && npm run build
```

**Step 4: Commit**

```bash
git add client/src/pages/Dashboard.jsx client/src/App.jsx
git commit -m "feat: add analytics dashboard with AnyChart (line, bar, radar charts)"
```

---

## Task 10: Test Sharing — Schema + API + Public Route

**Files:**
- Modify: `server/models/Test.js` (add shareId field)
- Create: `server/routes/share.js`
- Modify: `server/index.js` (mount share routes)
- Create: `client/src/pages/SharedTest.jsx`
- Modify: `client/src/App.jsx` (add /shared/:shareId route)
- Modify: `client/src/pages/Home.jsx` (add share button on test cards)

**Step 1: Add shareId to Test schema**

In `server/models/Test.js` (line 21-29, TestSchema), add:
```js
shareId: { type: String, unique: true, sparse: true },
```

Add index:
```js
TestSchema.index({ shareId: 1 }, { unique: true, sparse: true });
```

**Step 2: Create share routes**

Create `server/routes/share.js`:
```js
const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const Test = require('../models/Test');
const { requireAuth } = require('../middleware/auth');

// POST /api/tests/:id/share — generate share ID
router.post('/:id/share', requireAuth, async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) return res.status(404).json({ error: 'Test not found' });

  if (!test.shareId) {
    test.shareId = nanoid(10);
    await test.save();
  }

  const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/shared/${test.shareId}`;
  res.json({ shareId: test.shareId, shareUrl });
});

// GET /api/shared/:shareId — public test view
router.get('/:shareId', async (req, res) => {
  const test = await Test.findOne({ shareId: req.params.shareId });
  if (!test) return res.status(404).json({ error: 'Test not found' });

  // Return test metadata + question count (no answers for public view)
  res.json({
    _id: test._id,
    title: test.title,
    description: test.description,
    level: test.level,
    unit: test.unit,
    questionCount: test.questions.length,
    shareId: test.shareId,
  });
});

module.exports = router;
```

**Step 3: Mount routes in server/index.js**

```js
const shareRoutes = require('./routes/share');
app.use('/api/tests', shareRoutes);  // POST /api/tests/:id/share
app.use('/api/shared', shareRoutes); // GET /api/shared/:shareId
```

**Step 4: Add OG meta middleware**

In `server/index.js`, before the static file serving, add crawler detection middleware:
```js
app.get('/shared/:shareId', async (req, res, next) => {
  const ua = req.get('user-agent') || '';
  const isCrawler = /facebookexternalhit|twitterbot|linkedinbot|kakaotalk|slackbot|telegrambot/i.test(ua);
  if (!isCrawler) return next();

  const Test = require('./models/Test');
  const test = await Test.findOne({ shareId: req.params.shareId });
  if (!test) return next();

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  res.send(`<!DOCTYPE html><html><head>
    <meta property="og:title" content="${test.title}" />
    <meta property="og:description" content="KIIP Practice Test — ${test.questions.length} questions" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${clientUrl}/shared/${test.shareId}" />
  </head><body></body></html>`);
});
```

**Step 5: Create SharedTest page**

Create `client/src/pages/SharedTest.jsx`:
- Fetch from `GET /api/shared/:shareId`
- Display: title, description, level, unit, question count
- "Start Practice" button → link to `/test/:id`
- Simple, clean read-only layout

**Step 6: Add share button to Home.jsx test cards**

In `client/src/pages/Home.jsx`, add a share icon button on each test card. On click, call `POST /api/tests/:id/share`, then copy the returned URL to clipboard with a toast notification.

**Step 7: Add route in App.jsx**

```js
<Route path="/shared/:shareId" element={<SharedTest />} />
```

**Step 8: Commit**

```bash
git add server/models/Test.js server/routes/share.js server/index.js client/src/pages/SharedTest.jsx client/src/pages/Home.jsx client/src/App.jsx
git commit -m "feat: add test sharing via public links with OG meta tags"
```

---

## Task 11: Bulk Import — Backend

**Files:**
- Create: `server/routes/bulkImport.js`
- Modify: `server/index.js` (mount bulk import routes)

**Step 1: Create bulk import routes**

Create `server/routes/bulkImport.js`:
```js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Test = require('../models/Test');

const upload = multer({ dest: path.join(__dirname, '../uploads/temp/') });

// GET /api/admin/tests/import-template — download XLSX template
router.get('/import-template', requireAuth, requireAdmin, async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Questions');

  sheet.columns = [
    { header: 'Test Title', key: 'testTitle', width: 30 },
    { header: 'Question Text', key: 'questionText', width: 50 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Option A', key: 'optionA', width: 25 },
    { header: 'Option B', key: 'optionB', width: 25 },
    { header: 'Option C', key: 'optionC', width: 25 },
    { header: 'Option D', key: 'optionD', width: 25 },
    { header: 'Correct Answer', key: 'correctAnswer', width: 20 },
    { header: 'Explanation', key: 'explanation', width: 40 },
    { header: 'Level', key: 'level', width: 10 },
    { header: 'Unit', key: 'unit', width: 10 },
  ];

  // Add example row
  sheet.addRow({
    testTitle: 'KIIP Level 2 Unit 5',
    questionText: '한국에서 가장 큰 도시는 어디입니까?',
    type: 'mcq-single',
    optionA: '서울',
    optionB: '부산',
    optionC: '인천',
    optionD: '대구',
    correctAnswer: 'A',
    explanation: 'Seoul is the largest city in South Korea.',
    level: 'Level 2',
    unit: 'Unit 5',
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=kiip-import-template.xlsx');
  await workbook.xlsx.write(res);
});

// POST /api/admin/tests/bulk-import — upload + parse + validate → preview
router.post('/bulk-import', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let rows = [];

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      const sheet = workbook.worksheets[0];
      const headers = [];
      sheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value).trim();
      });
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const obj = {};
        row.eachCell((cell, colNumber) => {
          obj[headers[colNumber - 1]] = cell.value;
        });
        rows.push(obj);
      });
    } else if (ext === '.csv') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      rows = parsed.data;
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Use XLSX or CSV.' });
    }

    // Validate rows and group by test title
    const preview = validateAndGroup(rows);

    // Store parsed data in temp for confirm step
    const previewId = Date.now().toString(36);
    const previewPath = path.join(__dirname, `../uploads/temp/preview-${previewId}.json`);
    fs.writeFileSync(previewPath, JSON.stringify(preview));

    res.json({ previewId, ...preview });
  } finally {
    // Clean up uploaded file
    if (req.file) fs.unlinkSync(req.file.path);
  }
});

// POST /api/admin/tests/bulk-import/confirm — confirm import
router.post('/bulk-import/confirm', requireAuth, requireAdmin, async (req, res) => {
  const { previewId } = req.body;
  const previewPath = path.join(__dirname, `../uploads/temp/preview-${previewId}.json`);

  if (!fs.existsSync(previewPath)) {
    return res.status(404).json({ error: 'Preview expired. Please re-upload.' });
  }

  const preview = JSON.parse(fs.readFileSync(previewPath, 'utf-8'));
  fs.unlinkSync(previewPath);

  const results = { imported: 0, skipped: 0, errors: [] };

  for (const testData of preview.tests) {
    if (testData.errors.length > 0) {
      results.skipped++;
      continue;
    }
    try {
      const test = new Test({
        title: testData.title,
        level: testData.level,
        unit: testData.unit,
        category: 'Imported',
        questions: testData.questions,
      });
      await test.save();
      results.imported++;
    } catch (err) {
      results.errors.push({ title: testData.title, error: err.message });
    }
  }

  res.json(results);
});

function validateAndGroup(rows) {
  const testsMap = new Map();
  const errors = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed, skip header
    const title = String(row['Test Title'] || '').trim();
    const text = String(row['Question Text'] || '').trim();
    const type = String(row['Type'] || 'mcq-single').trim().toLowerCase();
    const correctAnswer = String(row['Correct Answer'] || '').trim();

    if (!title) { errors.push({ row: rowNum, error: 'Missing test title' }); return; }
    if (!text) { errors.push({ row: rowNum, error: 'Missing question text' }); return; }

    const validTypes = ['mcq-single', 'mcq-multiple', 'short-answer', 'ordering', 'fill-in-the-blank'];
    if (!validTypes.includes(type)) {
      errors.push({ row: rowNum, error: `Invalid type: ${type}` });
      return;
    }

    // Build question object
    const question = { text, type };
    if (type === 'mcq-single' || type === 'mcq-multiple') {
      const options = ['A', 'B', 'C', 'D']
        .map(letter => row[`Option ${letter}`])
        .filter(Boolean)
        .map(opt => String(opt).trim());

      if (options.length < 2) {
        errors.push({ row: rowNum, error: 'MCQ needs at least 2 options' });
        return;
      }

      const correctLetters = correctAnswer.toUpperCase().split(/[,\s]+/);
      question.options = options.map((text, i) => ({
        text,
        isCorrect: correctLetters.includes(String.fromCharCode(65 + i)),
      }));
    } else if (type === 'short-answer') {
      question.acceptedAnswers = correctAnswer.split(/[,|]/).map(a => a.trim());
    } else if (type === 'ordering') {
      question.correctOrder = correctAnswer.split(/[,\s]+/).map(Number);
    } else if (type === 'fill-in-the-blank') {
      question.blanks = correctAnswer.split('|').map(answers => ({
        acceptedAnswers: answers.split(',').map(a => a.trim()),
      }));
    }

    if (row['Explanation']) question.explanation = String(row['Explanation']).trim();

    if (!testsMap.has(title)) {
      testsMap.set(title, {
        title,
        level: row['Level'] ? String(row['Level']).trim() : undefined,
        unit: row['Unit'] ? String(row['Unit']).trim() : undefined,
        questions: [],
        errors: [],
      });
    }
    testsMap.get(title).questions.push(question);
  });

  return {
    tests: Array.from(testsMap.values()),
    totalRows: rows.length,
    globalErrors: errors,
  };
}

module.exports = router;
```

**Step 2: Mount in server/index.js**

```js
const bulkImportRoutes = require('./routes/bulkImport');
app.use('/api/admin/tests', bulkImportRoutes);
```

**Step 3: Commit**

```bash
git add server/routes/bulkImport.js server/index.js
git commit -m "feat: add bulk import API (XLSX/CSV parse, validate, preview, confirm)"
```

---

## Task 12: Bulk Import — Frontend

**Files:**
- Create: `client/src/pages/AdminBulkImport.jsx`
- Modify: `client/src/App.jsx` (add route)

**Step 1: Create AdminBulkImport page**

Create `client/src/pages/AdminBulkImport.jsx`:
- Download template button (links to `GET /api/admin/tests/import-template`)
- File upload zone (drag & drop styled like CreateTest)
- Preview table: shows parsed tests with row-by-row validation (green=valid, red=error, yellow=duplicate)
- Confirm import button with summary count
- Success/error result display
- All text via `useTranslation()`
- Responsive layout

**Step 2: Add route in App.jsx**

```js
<Route path="/admin/import" element={<AdminBulkImport />} />
```

Add nav link for admins.

**Step 3: Commit**

```bash
git add client/src/pages/AdminBulkImport.jsx client/src/App.jsx
git commit -m "feat: add admin bulk import UI with preview and validation"
```

---

## Task 13: Question Deduplication — Backend + Frontend

**Files:**
- Create: `server/utils/dedup.js`
- Create: `server/routes/duplicates.js`
- Modify: `server/index.js` (mount)
- Create: `client/src/pages/AdminDuplicates.jsx`
- Modify: `client/src/App.jsx` (add route)

**Step 1: Create dedup utility**

Create `server/utils/dedup.js`:
```js
const stringSimilarity = require('string-similarity');

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\uAC00-\uD7AF\u3130-\u318F]/g, '')
    .trim();
}

function findDuplicates(questions, threshold = 0.75) {
  const clusters = [];
  const seen = new Set();

  for (let i = 0; i < questions.length; i++) {
    if (seen.has(i)) continue;
    const cluster = [{ index: i, question: questions[i] }];

    for (let j = i + 1; j < questions.length; j++) {
      if (seen.has(j)) continue;
      const score = stringSimilarity.compareTwoStrings(
        normalize(questions[i].text),
        normalize(questions[j].text)
      );
      if (score >= threshold) {
        cluster.push({ index: j, question: questions[j], score: Math.round(score * 100) });
        seen.add(j);
      }
    }

    if (cluster.length > 1) {
      seen.add(i);
      clusters.push(cluster);
    }
  }

  return clusters;
}

function checkAgainstExisting(newQuestions, existingQuestions, threshold = 0.75) {
  return newQuestions.map((nq, idx) => {
    const normalizedNew = normalize(nq.text);
    const matches = [];
    for (const eq of existingQuestions) {
      const score = stringSimilarity.compareTwoStrings(normalizedNew, normalize(eq.text));
      if (score >= threshold) {
        matches.push({ question: eq, score: Math.round(score * 100) });
      }
    }
    return { index: idx, question: nq, duplicates: matches.sort((a, b) => b.score - a.score) };
  }).filter(r => r.duplicates.length > 0);
}

module.exports = { findDuplicates, checkAgainstExisting, normalize };
```

**Step 2: Create duplicates route**

Create `server/routes/duplicates.js`:
```js
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Test = require('../models/Test');
const { findDuplicates } = require('../utils/dedup');

// GET /api/admin/duplicates — scan for duplicates across tests
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { level, threshold = 0.75 } = req.query;
  const filter = level ? { level } : {};
  const tests = await Test.find(filter).lean();

  // Flatten all questions with test context
  const allQuestions = [];
  for (const test of tests) {
    for (let i = 0; i < test.questions.length; i++) {
      allQuestions.push({
        ...test.questions[i],
        testId: test._id,
        testTitle: test.title,
        questionIndex: i,
      });
    }
  }

  const clusters = findDuplicates(allQuestions, parseFloat(threshold));
  res.json({ totalQuestions: allQuestions.length, clusters });
});

module.exports = router;
```

**Step 3: Mount route**

In `server/index.js`:
```js
const duplicatesRoutes = require('./routes/duplicates');
app.use('/api/admin/duplicates', duplicatesRoutes);
```

**Step 4: Create AdminDuplicates page**

Create `client/src/pages/AdminDuplicates.jsx`:
- Fetches from `GET /api/admin/duplicates`
- Filter by level
- Threshold slider (0.50 - 1.00, default 0.75)
- Shows duplicate clusters as cards
- Each card shows question pairs with similarity score
- Action buttons: "Keep Both" (dismiss), "Skip" (mark reviewed)
- All text via `useTranslation()`

**Step 5: Add route in App.jsx**

```js
<Route path="/admin/duplicates" element={<AdminDuplicates />} />
```

**Step 6: Integrate dedup into bulk import preview**

In `server/routes/bulkImport.js`, after parsing rows, run `checkAgainstExisting()` against the database and include duplicate warnings in the preview response.

**Step 7: Commit**

```bash
git add server/utils/dedup.js server/routes/duplicates.js server/index.js client/src/pages/AdminDuplicates.jsx client/src/App.jsx server/routes/bulkImport.js
git commit -m "feat: add question deduplication (scan, import integration, admin audit page)"
```

---

## Task 14: Phase 7 Build Verification

**Step 1: Run lint**

```bash
cd client && npm run lint
```

Fix any lint errors.

**Step 2: Run build**

```bash
cd client && npm run build
```

Must succeed with zero errors.

**Step 3: Verify server starts**

```bash
cd server && node -e "require('./index.js')"
```

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and build errors from Phase 7 features"
```

---

## Task 15: Playwright MCP Testing — Full App Validation

**Step 1: Start the app**

```bash
npm start
```

**Step 2: Test all navigation links**

Use Playwright MCP to navigate to every route:
- `/` (Home)
- `/dashboard` (requires auth — verify redirect or empty state)
- `/endless` (Endless mode)
- `/admin/import` (admin-only)
- `/admin/duplicates` (admin-only)
- `/admin/flags` (admin-only)

Verify: no broken routes, no console errors, all pages render.

**Step 3: Test theme toggle**

- Click theme toggle button in navbar
- Verify: background color changes, text remains readable, no FOUC
- Toggle through: system → light → dark → system

**Step 4: Test language switcher**

- Switch to each language (EN → KO → RU → ES)
- Verify: nav labels change, page titles change, no missing translations (no raw keys shown)

**Step 5: Test responsive layout**

- Set viewport to 480px width
- Verify: no horizontal overflow, single-column grid, bottom sticky controls in TestTaker

**Step 6: Test sharing**

- Click share button on a test card
- Verify: share URL is generated, clipboard has the URL
- Navigate to `/shared/:shareId` — verify read-only view renders

**Step 7: Fix any issues found**

Document and fix each issue. Re-run the failing test.

**Step 8: Commit fixes**

```bash
git add -A
git commit -m "fix: address issues found during Playwright testing"
```

---

## Task 16: Second Playwright Pass + Security Audit

**Step 1: Re-run all Playwright tests**

```bash
npx playwright test
```

Verify all existing tests still pass (no regressions).

**Step 2: Test new features with Playwright MCP**

- Dashboard: verify charts render with data (if test data exists)
- Bulk import: upload a CSV, verify preview table appears
- Duplicates: verify page loads and shows scan results

**Step 3: Security audit**

Run gitleaks (if available) or manually check:
```bash
git log --diff-filter=A --summary | grep -i -E "\.env|secret|key|password|credential"
```

Verify:
- No `.env` files committed
- No API keys in source code
- No credentials in git history
- `helmet` is active (check response headers via curl)
- `express-mongo-sanitize` is active (test with `$gt` in query param — should be stripped)

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final security audit and testing fixes"
```

---

## Task 17: Update Documentation

**Files:**
- Modify: `IMPLEMENTATION_PLAN.md`
- Modify: `CLAUDE.md`
- Modify: `additionalContext/project_context.md`
- Modify: `additionalContext/SETUP_AND_USAGE.md`

**Step 1: Update IMPLEMENTATION_PLAN.md**

Add Phase 7 section with all 8 features marked complete.

**Step 2: Update CLAUDE.md**

- Add new dependencies to tech stack
- Add new API endpoints
- Add new routes
- Update schemas
- Add new env vars (if any)

**Step 3: Update project docs**

Update SETUP_AND_USAGE.md with new features, commands, and configuration.

**Step 4: Commit**

```bash
git add IMPLEMENTATION_PLAN.md CLAUDE.md additionalContext/
git commit -m "docs: update all documentation for Phase 7 features"
```

---

## Summary

| Task | Feature | Files Changed |
|------|---------|---------------|
| 1 | Install dependencies | package.json (both) |
| 2 | Security middleware | server/index.js |
| 3 | Secrets audit | .gitignore |
| 4 | Dark theme | tokens.js, ThemeContext, App.jsx, GlobalStyles |
| 5 | i18n (4 languages) | i18n/, locales (4), main.jsx, all pages |
| 6 | Mobile responsive | breakpoints.js, App.jsx, all pages |
| 7 | User preferences API | User.js, auth.js |
| 8 | Stats API | stats.js, index.js |
| 9 | Analytics dashboard | Dashboard.jsx, App.jsx |
| 10 | Test sharing | Test.js, share.js, SharedTest.jsx, Home.jsx |
| 11 | Bulk import backend | bulkImport.js, index.js |
| 12 | Bulk import frontend | AdminBulkImport.jsx, App.jsx |
| 13 | Question dedup | dedup.js, duplicates.js, AdminDuplicates.jsx |
| 14 | Build verification | Lint/build fixes |
| 15 | Playwright testing | Bug fixes |
| 16 | Second pass + security | Security fixes |
| 17 | Documentation | CLAUDE.md, IMPLEMENTATION_PLAN.md, etc. |
